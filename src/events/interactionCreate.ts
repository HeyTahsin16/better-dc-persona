import { Interaction } from 'discord.js';
import { commandMap } from '../commands/registry';
import { getRole, roleLabel } from '../permissions/roles';
import { Role } from '../types';
import { logger } from '../logger';
import { friendlyError } from '../utils/friendlyError';

export async function onInteractionCreate(interaction: Interaction): Promise<void> {
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
