import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ColorResolvable } from 'discord.js';
import path from 'path';
import { SlashCommand } from './types';
import { Role } from '../types';
import { hasRole } from '../permissions/roles';
import { listPersonas, getPersona, isValidPersonaId, searchPersonas, listVersions } from '../personas';
import { setPersonaId, state } from '../store/stateStore';
import { getUserPersonaId, setUserPersonaId, clearUserPersonaId } from '../store/userPersonaStore';
import { getActivePersona } from '../ai/promptBuilder';
import { NEUTRAL_PERSONA_ID } from '../constants';
import { replyChunked } from '../utils/interactionReply';
import { getAvatarFilePath } from '../webhooks/avatarResolver';
import { getBackgroundFilePath } from '../features/moodCard';
import { buildRatingPrompt } from '../features/ratingPrompt';
import { setRating, getPersonaRatingStats, getLeaderboard } from '../store/ratingStore';
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

// Was two separate commands (/persona for the server default, /mypersona for
// your own personal pick) — same underlying concept (choose/view a persona),
// same search-by-name autocomplete, just different scope. Server-scope stays
// at the top level unchanged (existing muscle memory: /persona current,
// /persona list, /persona set, /persona profile all still work exactly as
// before); personal-scope moves in as a "my" subcommand group.
export const personaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('persona')
    .setDescription('View or switch personas — server default or your own personal pick')
    .addSubcommand(s => s.setName('current').setDescription('Show the server-wide default persona'))
    .addSubcommand(s => s.setName('profile').setDescription("View a character's profile: avatar, bio, and background art")
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('rate').setDescription('Rate how lore-accurate a persona feels, 1-10')
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName('rating').setDescription('1 (not accurate) to 10 (perfectly accurate)').setRequired(true).setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Top personas by lore-accuracy rating'))
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
      }))
    .addSubcommandGroup(g => g.setName('my').setDescription('Your own personal persona pick — only affects you')
      .addSubcommand(s => s.setName('set').setDescription('Choose which persona you personally talk to by default')
        .addStringOption(o => o.setName('id').setDescription('Start typing a name to search').setRequired(true).setAutocomplete(true))
        .addStringOption(o => {
          o.setName('version').setDescription('Optional: browse only personas added in a specific version first');
          for (const v of listVersions()) o.addChoices({ name: v, value: v });
          return o;
        }))
      .addSubcommand(s => s.setName('current').setDescription('Show your personal persona'))
      .addSubcommand(s => s.setName('clear').setDescription('Stop using a personal persona — go back to the server default'))),

  minRole: Role.USER,

  // Unchanged logic — both the server-scope `id` option (on `set`) and the
  // personal-scope `id` option (on `my set`) search the same way, so one
  // handler covers both without needing to check which one is focused.
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
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'my') {
      const userId = interaction.user.id;

      if (sub === 'set') {
        const id = interaction.options.getString('id', true);
        if (!isValidPersonaId(id)) {
          await interaction.reply({ content: `❌ Unknown persona \`${id}\` — try searching again with the autocomplete list.`, ephemeral: true });
          return;
        }
        setUserPersonaId(userId, id);
        const persona = getPersona(id)!;
        await interaction.reply({
          content: `🎭 Your personal persona is now **${persona.name}** (${persona.source}). This only affects you — fresh @mentions and DMs from you will talk to ${persona.name} regardless of the server's default.`,
          ephemeral: true,
        });
        return;
      }

      if (sub === 'clear') {
        const removed = clearUserPersonaId(userId);
        const fallback = getActivePersona();
        await interaction.reply({
          content: removed
            ? `🗑️ Personal persona cleared. You'll now get the server default (currently **${fallback.name}**) for fresh @mentions and DMs.`
            : `You didn't have a personal persona set — you're already using the server default (currently **${fallback.name}**).`,
          ephemeral: true,
        });
        return;
      }

      // my current
      const chosenId = getUserPersonaId(userId);
      if (!chosenId) {
        const fallback = getActivePersona();
        await interaction.reply({
          content: `You haven't set a personal persona — you're currently getting the server default: **${fallback.name}** (${fallback.source}). Use \`/persona my set\` to pick your own.`,
          ephemeral: true,
        });
        return;
      }
      const persona = getPersona(chosenId);
      if (!persona) {
        await interaction.reply({ content: `Your saved persona (\`${chosenId}\`) no longer exists — falling back to the server default. Use \`/persona my set\` to pick a new one.`, ephemeral: true });
        return;
      }
      await interaction.reply({ content: `**🎭 Your persona: ${persona.name}** — *${persona.source}*\n> ${persona.description.slice(0, 400)}${persona.description.length > 400 ? '…' : ''}`, ephemeral: true });
      return;
    }

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

        // Rating sits right after the name in the author line — there's no
        // "right side of a line" concept in a Discord embed, so appending it
        // to the same string is the closest real equivalent.
        const stats = getPersonaRatingStats(persona.id);
        const ratingText = stats
          ? `⭐ ${stats.average.toFixed(1)}/10 (${stats.count} rating${stats.count === 1 ? '' : 's'})`
          : '⭐ Not yet rated';
        const authorName = `${persona.name}  ·  ${ratingText}`;

        const avatarPath = getAvatarFilePath(persona.avatarKey);
        if (avatarPath) {
          const avatarFile = `persona-avatar${path.extname(avatarPath)}`;
          files.push(new AttachmentBuilder(avatarPath, { name: avatarFile }));
          embed.setAuthor({ name: authorName, iconURL: `attachment://${avatarFile}` });
        } else {
          embed.setAuthor({ name: authorName });
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

        const { embed: rateEmbed, row: rateRow } = buildRatingPrompt(persona.id, persona.name);
        await interaction.editReply({ embeds: [embed, rateEmbed], files, components: [rateRow] });
      } catch (err) {
        logger.error('[persona] Profile command failed', err);
        await interaction.editReply({ content: `**${persona.name}** — *${persona.source}*\n${persona.description}` });
      }
      return;
    }

    if (sub === 'rate') {
      const id = interaction.options.getString('persona', true);
      if (!isValidPersonaId(id)) {
        await interaction.reply({ content: `❌ Unknown persona \`${id}\` — try searching again with the autocomplete list.`, ephemeral: true });
        return;
      }
      const persona = getPersona(id)!;
      const rating = interaction.options.getInteger('rating', true);
      setRating(interaction.user.id, id, rating);
      const stats = getPersonaRatingStats(id)!; // guaranteed non-null, we just wrote a rating
      await interaction.reply({
        content: `Thanks! You rated **${persona.name}** ${rating}/10 for lore accuracy. (${persona.name} is now at ${stats.average.toFixed(1)}/10 across ${stats.count} rating${stats.count === 1 ? '' : 's'}.)`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'leaderboard') {
      const entries = getLeaderboard();
      if (!entries.length) {
        await interaction.reply({ content: 'No personas have been rated yet — be the first with `/persona rate` or the rating prompt under `/affection mood` / `/persona profile`!', ephemeral: true });
        return;
      }
      const top = entries.slice(0, 20);
      const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);
      const lines = top.map((entry, i) => {
        const persona = getPersona(entry.personaId);
        const name = persona ? persona.name : entry.personaId; // defensive: persona removed since being rated
        return `${medal(i)} **${name}** — ⭐ ${entry.average.toFixed(1)}/10 (${entry.count} rating${entry.count === 1 ? '' : 's'})`;
      });
      const title = `**🏆 Lore-Accuracy Leaderboard**${entries.length > top.length ? ` — top ${top.length} of ${entries.length} rated` : ''}`;
      await replyChunked(interaction, `${title}\n${lines.join('\n')}`, false);
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
        `✅ = server-wide default · ⭐ = fixed neutral persona (welcome messages) · 👤 = your personal pick (see \`/persona my\`)`
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
        `for anyone who hasn't picked their own with \`/persona my set\`. Existing reply-threads and personal picks are unaffected.`
      );
      return;
    }

    // current
    const persona = getPersona(state.personaId) ?? listPersonas()[0];
    const desc = persona.description.slice(0, 400);
    await interaction.reply({
      content: `**🎭 Server-wide default: ${persona.name}** — *${persona.source}*\n> ${desc}${persona.description.length > 400 ? '…' : ''}\n\nUse \`/persona my current\` to see what *you* personally get.`,
      ephemeral: true,
    });
  },
};
