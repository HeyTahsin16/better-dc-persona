import { GuildMember } from 'discord.js';
import { sendWelcomeMessage } from '../features/welcome';
import { logger } from '../logger';

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    await sendWelcomeMessage(member);
  } catch (err) {
    logger.error('Failed to send welcome message', err);
  }
}
