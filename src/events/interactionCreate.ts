import { Interaction } from 'discord.js';
import { commandMap } from '../commands/registry';
import { getRole, roleLabel } from '../permissions/roles';
import { Role } from '../types';
import { logger } from '../logger';
import { friendlyError } from '../utils/friendlyError';
import { parseRateCustomId } from '../features/ratingPrompt';
import { setRating, getPersonaRatingStats } from '../store/ratingStore';
import { getPersona, isValidPersonaId } from '../personas';

export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isStringSelectMenu()) {
    const personaId = parseRateCustomId(interaction.customId);
    if (!personaId) return; // not one of ours — ignore rather than error
    try {
      if (!isValidPersonaId(personaId)) {
        await interaction.reply({ content: "This persona doesn't exist anymore.", ephemeral: true });
        return;
      }
      const persona = getPersona(personaId)!;
      const rating = parseInt(interaction.values[0], 10);
      setRating(interaction.user.id, personaId, rating);
      const stats = getPersonaRatingStats(personaId)!; // guaranteed non-null, we just wrote a rating
      await interaction.reply({
        content: `Thanks! You rated **${persona.name}** ${rating}/10 for lore accuracy. (${persona.name} is now at ${stats.average.toFixed(1)}/10 across ${stats.count} rating${stats.count === 1 ? '' : 's'}.)`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('Rating select menu failed', err);
      await interaction.reply({ content: 'Something went wrong recording that rating — try again?', ephemeral: true }).catch(() => undefined);
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      logger.error(`Autocomplete for /${interaction.commandName} failed`, err);
      // Autocomplete has no user-visible error path — respond empty rather than leaving it hanging.
      await interaction.respond([]).catch(() => undefined);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  const role = getRole(interaction.user.id);
  if (role < command.minRole) {
    await interaction.reply({
      content: role === Role.NONE
        ? "you're not on the list, sorry 🚫"
        : `🚫 This requires **${roleLabel(command.minRole)}** access (you have ${roleLabel(role)}).`,
      ephemeral: true,
    });
    return;
  }

  try {
    logger.info(`/${interaction.commandName} used by ${interaction.user.username} (${interaction.user.id})`);
    await command.execute(interaction);
  } catch (err) {
    logger.error(`Command /${interaction.commandName} failed`, err);
    const message = friendlyError(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
}
