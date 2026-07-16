import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { getPersona, isValidPersonaId, searchPersonas, listVersions } from '../personas';
import { getUserPersonaId, setUserPersonaId, clearUserPersonaId } from '../store/userPersonaStore';
import { getActivePersona } from '../ai/promptBuilder';

export const myPersonaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('mypersona')
    .setDescription('Set your own personal persona — only affects you, not anyone else')
    .addSubcommand(s => s.setName('set').setDescription('Choose which persona you personally talk to by default')
      .addStringOption(o => o.setName('id').setDescription('Start typing a name to search').setRequired(true).setAutocomplete(true))
      .addStringOption(o => {
        o.setName('version').setDescription('Optional: browse only personas added in a specific version first');
        for (const v of listVersions()) o.addChoices({ name: v, value: v });
        return o;
      }))
    .addSubcommand(s => s.setName('current').setDescription('Show your personal persona'))
    .addSubcommand(s => s.setName('clear').setDescription('Stop using a personal persona — go back to the server default')),

  minRole: Role.USER,

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const version = interaction.options.getString('version') ?? undefined;
    const matches = searchPersonas(focused, version);
    await interaction.respond(matches.map(p => ({ name: `${p.name} (${p.source})`, value: p.id })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
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

    // current
    const chosenId = getUserPersonaId(userId);
    if (!chosenId) {
      const fallback = getActivePersona();
      await interaction.reply({
        content: `You haven't set a personal persona — you're currently getting the server default: **${fallback.name}** (${fallback.source}). Use \`/mypersona set\` to pick your own.`,
        ephemeral: true,
      });
      return;
    }
    const persona = getPersona(chosenId);
    if (!persona) {
      await interaction.reply({ content: `Your saved persona (\`${chosenId}\`) no longer exists — falling back to the server default. Use \`/mypersona set\` to pick a new one.`, ephemeral: true });
      return;
    }
    await interaction.reply({ content: `**🎭 Your persona: ${persona.name}** — *${persona.source}*\n> ${persona.description.slice(0, 400)}${persona.description.length > 400 ? '…' : ''}`, ephemeral: true });
  },
};
