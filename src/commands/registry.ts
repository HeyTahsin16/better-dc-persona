import { REST, Routes } from 'discord.js';
import { env } from '../env';
import { logger } from '../logger';
import { SlashCommand } from './types';
import { baseCommands } from './baseCommands';
import { helpCommand } from './help';

export const commands: SlashCommand[] = [...baseCommands, helpCommand];

export const commandMap = new Map<string, SlashCommand>(commands.map(c => [c.data.name, c]));

export async function registerCommands(): Promise<void> {
  if (!env.CLIENT_ID) {
    logger.warn('CLIENT_ID not set — slash commands will not be registered.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  try {
    logger.info(`Registering ${commands.length} slash commands...`);
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commands.map(c => c.data.toJSON()) });
    logger.info('Slash commands registered globally.');
  } catch (err) {
    logger.error('Failed to register slash commands', err);
  }
}
