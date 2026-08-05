import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ColorResolvable } from 'discord.js';
import path from 'path';
import { SlashCommand } from './types';
import { Role } from '../types';
import { hasRole } from '../permissions/roles';
import { listPersonas, getPersona, isValidPersonaId, searchPersonas, listVersions } from '../personas';
import { setPersonaId, state } from '../store/stateStore';
import { getUserPersonaId } from '../store/userPersonaStore';
import { NEUTRAL_PERSONA_ID } from '../constants';
import { replyChunked } from '../utils/interactionReply';
import { getAvatarFilePath } from '../webhooks/avatarResolver';
import { getBackgroundFilePath } from '../features/moodCard';
import { logger } from '../logger';

// Deterministic per-persona accent color (hash the avatarKey -> hue, fixed
// saturation/lightness) so every character's profile card gets a distinct,
// stable strip color without needing 40+ colors hand-picked and maintained.
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function personaAccentColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hslToHex(hash % 360, 62, 68);
}

export const personaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('persona')
    .setDescription('View or switch the server-wide default persona')
    .addSubcommand(s => s.setName('current').setDescription('Show the server-wide default persona'))
    .addSubcommand(s => s.setName('profile').setDescription("View a character's profile: avatar, bio, and background art")
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all available personas')
      .addStringOption(o => {
        o.setName('version').setDescription('Optional: only show personas added in a specific version');
        for (const v of listVersions()) o.addChoices({ name: v, value: v });
        return o;
      }))
    .addSubcommand(s => s.setName('set').setDescription('[Admin+] Switch the server-wide default persona')
      .addStringOption(o => o.setName('id').setDescription('Start typing a name to search').setRequired(true).setAutocomplete(true))
      .addStringOption(o => {
        o.setName('version').setDescription('Optional: browse only personas added in a specific version first');
        for (const v of listVersions()) o.addChoices({ name: v, value: v });
        return o;
      })),

  minRole: Role.USER,

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const version = interaction.options.getString('version') ?? undefined;
    const matches = searchPersonas(focused, version);
    await interaction.respond(matches.map(p => ({
      name: `${p.name} (${p.source})${p.id === NEUTRAL_PERSONA_ID ? ' — neutral default' : ''}`,
      value: p.id,
    })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'profile') {
      const id = interaction.options.getString('persona', true);
      if (!isValidPersonaId(id)) {
        await interaction.reply({ content: `❌ Unknown persona \`${id}\` — try searching again with the autocomplete list.`, ephemeral: true });
        return;
      }
      const persona = getPersona(id)!;
      await interaction.deferReply();
      try {
        const files: AttachmentBuilder[] = [];
        const embed = new EmbedBuilder()
          .setColor(personaAccentColor(persona.avatarKey) as ColorResolvable)
          .setDescription(persona.description)
          .setFooter({ text: persona.source });

        const avatarPath = getAvatarFilePath(persona.avatarKey);
        if (avatarPath) {
          const avatarFile = `persona-avatar${path.extname(avatarPath)}`;
          files.push(new AttachmentBuilder(avatarPath, { name: avatarFile }));
          embed.setAuthor({ name: persona.name, iconURL: `attachment://${avatarFile}` });
        } else {
          embed.setAuthor({ name: persona.name });
        }

        // Raw background art, unedited — no avatar composited on top, unlike
        // the /affection mood card. Silently omitted if this persona doesn't
        // have one uploaded yet, rather than faking one in.
        const backgroundPath = getBackgroundFilePath(persona.avatarKey);
        if (backgroundPath) {
          const bgFile = `persona-background${path.extname(backgroundPath)}`;
          files.push(new AttachmentBuilder(backgroundPath, { name: bgFile }));
          embed.setImage(`attachment://${bgFile}`);
        }

        await interaction.editReply({ embeds: [embed], files });
      } catch (err) {
        logger.error('[persona] Profile command failed', err);
        await interaction.editReply({ content: `**${persona.name}** — *${persona.source}*\n${persona.description}` });
      }
      return;
    }

    if (sub === 'list') {
      const versionFilter = interaction.options.getString('version') ?? undefined;
      const callerChoice = getUserPersonaId(interaction.user.id);
      // listPersonas() is already A-Z by name — filtering preserves that order.
      const personasToShow = versionFilter ? listPersonas().filter(p => p.addedInVersion === versionFilter) : listPersonas();

      const line = (p: (typeof personasToShow)[number]) => {
        const serverDefault = p.id === state.personaId ? '✅' : '•';
        const neutral = p.id === NEUTRAL_PERSONA_ID ? ' ⭐' : '';
        const personal = p.id === callerChoice ? ' 👤 *(your pick)*' : '';
        return `${serverDefault} **${p.name}** — *${p.source}*${neutral}${personal}`;
      };

      const body = personasToShow.map(line).join('\n') || `*No personas were added in ${versionFilter}.*`;

      await replyChunked(interaction,
        `**Available personas${versionFilter ? ` — ${versionFilter}` : ' (A-Z)'}:**\n${body}\n\n` +
        `✅ = server-wide default · ⭐ = fixed neutral persona (welcome messages) · 👤 = your personal pick (see \`/mypersona\`)`
      );
      return;
    }

    if (sub === 'set') {
      if (!hasRole(interaction.user.id, Role.ADMIN)) {
        await interaction.reply({ content: '🚫 Requires Admin access to switch the server-wide default persona.', ephemeral: true });
        return;
      }
      const id = interaction.options.getString('id', true);
      if (!isValidPersonaId(id)) {
        await interaction.reply({ content: `❌ Unknown persona \`${id}\` — try searching again with the autocomplete list.`, ephemeral: true });
        return;
      }
      setPersonaId(id);
      const persona = getPersona(id)!;
      await interaction.reply(
        `🎭 Server-wide default persona switched to **${persona.name}** (${persona.source}) — this is what fresh @mentions/DMs use ` +
        `for anyone who hasn't picked their own with \`/mypersona set\`. Existing reply-threads and personal picks are unaffected.`
      );
      return;
    }

    // current
    const persona = getPersona(state.personaId) ?? listPersonas()[0];
    const desc = persona.description.slice(0, 400);
    await interaction.reply({
      content: `**🎭 Server-wide default: ${persona.name}** — *${persona.source}*\n> ${desc}${persona.description.length > 400 ? '…' : ''}\n\nUse \`/mypersona current\` to see what *you* personally get.`,
      ephemeral: true,
    });
  },
};
