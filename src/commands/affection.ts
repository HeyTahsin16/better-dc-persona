import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { hasRole } from '../permissions/roles';
import { getAffectionScore, getAffectionLevel, getAffectionMoodPhrase, resetAffection } from '../store/affectionStore';
import { searchPersonas, getPersona, isValidPersonaId } from '../personas';

export const affectionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('affection')
    .setDescription('See how a persona feels about someone, based on past interactions')
    .addSubcommand(s => s.setName('mood').setDescription('A casual, no-numbers read on how a persona feels about you')
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('view').setDescription('[Admin+] View the exact score')
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('user').setDescription('View a specific user (default: yourself)')))
    .addSubcommand(s => s.setName('reset').setDescription("[Owner] Reset a user's standing with a persona back to neutral")
      .addUserOption(o => o.setName('user').setDescription('Whose score to reset').setRequired(true))
      .addStringOption(o => o.setName('persona').setDescription('Which persona').setRequired(true).setAutocomplete(true))),

  minRole: Role.USER,

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = searchPersonas(focused);
    await interaction.respond(matches.map(p => ({ name: `${p.name} (${p.source})`, value: p.id })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const personaId = interaction.options.getString('persona', true);
    if (!isValidPersonaId(personaId)) {
      await interaction.reply({ content: `Unknown persona "${personaId}" — try searching again with the autocomplete list.`, ephemeral: true });
      return;
    }
    const persona = getPersona(personaId)!;

    // mood — open to everyone, casual read, no numbers, self only.
    if (sub === 'mood') {
      const phrase = getAffectionMoodPhrase(interaction.user.id, personaId, persona.name);
      await interaction.reply({ content: phrase, ephemeral: true });
      return;
    }

    // view — Admin+.
    if (sub === 'view') {
      if (!hasRole(interaction.user.id, Role.ADMIN)) {
        await interaction.reply({ content: 'This requires Admin access.', ephemeral: true });
        return;
      }
      const targetOption = interaction.options.getUser('user');
      const targetId = targetOption?.id ?? interaction.user.id;
      const score = getAffectionScore(targetId, personaId);
      const level = getAffectionLevel(targetId, personaId);
      await interaction.reply({
        content:
          `${persona.name}'s standing with ${targetOption ? `<@${targetId}>` : 'you'}:\n` +
          `Score: ${Math.round(score)} — Level: ${level > 0 ? `+${level}` : level} (range: -5 to +5)`,
        ephemeral: true,
      });
      return;
    }

    // reset — Owner only.
    if (sub === 'reset') {
      if (!hasRole(interaction.user.id, Role.OWNER)) {
        await interaction.reply({ content: 'This requires Owner access.', ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      resetAffection(target.id, personaId);
      await interaction.reply({ content: `Reset <@${target.id}>'s standing with ${persona.name} back to neutral.`, ephemeral: true });
    }
  },
};
