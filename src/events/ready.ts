import { Client, ActivityType } from 'discord.js';
import { logger } from '../logger';
import { state, activeChatModel, activeImageModel } from '../store/stateStore';
import { listAuthorized } from '../store/authStore';
import { loadAppEmojis } from '../emoji/appEmojis';
import { refreshAvatarCache, getPublicBaseUrl } from '../webhooks/avatarResolver';
import { registerCommands } from '../commands/registry';
import { startReminderScheduler } from '../features/reminders';
import { getActivePersona } from '../ai/promptBuilder';

export async function onReady(client: Client<true>): Promise<void> {
  logger.info(`${client.user.tag} online`);
  const persona = getActivePersona();
  logger.info(`Persona: ${persona.name} (${persona.source})`);
  logger.info(`Chat provider: ${state.chatProvider} / ${activeChatModel()}`);
  logger.info(`Image provider: ${state.imageProvider} / ${activeImageModel()}`);
  logger.info(`Authorized users: ${listAuthorized().length}`);

  refreshAvatarCache();
  const publicUrl = getPublicBaseUrl();
  if (publicUrl) logger.info(`Avatar public URL: ${publicUrl}/avatars/`);
  else logger.warn('No public URL configured (PUBLIC_URL or RAILWAY_PUBLIC_DOMAIN) — persona webhooks will use default icons instead of custom avatars.');

  await loadAppEmojis(client);
  await registerCommands();
  startReminderScheduler(client);

  client.user.setPresence({
    activities: [{ name: persona.status || `as ${persona.name}`, type: ActivityType.Playing }],
    status: 'online',
  });
}
