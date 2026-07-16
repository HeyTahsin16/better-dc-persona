import { TextChannel, NewsChannel, Webhook, WebhookType } from 'discord.js';
import { logger } from '../logger';
import { getAvatarUrl } from './avatarResolver';
import { Persona } from '../types';
import { recordPersonaMessage } from './threadTracker';
import { chunkText } from '../utils/chunk';

export type WebhookCapableChannel = TextChannel | NewsChannel;

const WEBHOOK_NAME = 'Persona Relay';
const webhookCache = new Map<string, Webhook<WebhookType.Incoming>>(); // channelId -> webhook

async function getOrCreateWebhook(channel: WebhookCapableChannel): Promise<Webhook<WebhookType.Incoming> | null> {
  const cached = webhookCache.get(channel.id);
  if (cached) return cached;

  try {
    const existing = await channel.fetchWebhooks();
    let webhook = existing.find(w => w.name === WEBHOOK_NAME && w.isIncoming());
    if (!webhook) {
      webhook = await channel.createWebhook({ name: WEBHOOK_NAME, reason: 'Persona relay for AI character replies' });
      logger.info(`Created persona webhook in #${channel.name}`);
    }
    webhookCache.set(channel.id, webhook as Webhook<WebhookType.Incoming>);
    return webhook as Webhook<WebhookType.Incoming>;
  } catch (err) {
    logger.error(`Could not get/create a webhook in #${channel.name} — check the bot has "Manage Webhooks" permission`, err);
    return null;
  }
}

// Discord's webhook API has never supported true message replies (message_reference) —
// a long-standing, still-open platform limitation, not something discord.js can work
// around. This is the practical substitute: prefix the first chunk with an @mention of
// whoever the bot is responding to, so it's unambiguous even with several people talking
// to different personas at once in the same channel.
function withMentionPrefix(chunks: string[], mentionUserId?: string): string[] {
  if (!mentionUserId || !chunks.length) return chunks;
  return [`<@${mentionUserId}> ${chunks[0]}`, ...chunks.slice(1)];
}

// Sends `text` through the channel's shared persona webhook under a plain display
// name (e.g. the active AI model, like "Gemini 2.5 Flash") with NO avatar override —
// Discord shows the webhook's generic default icon. Used for "noper" raw-AI replies.
// `personaIdToResume` is tracked exactly like a normal persona message, so a later
// reply WITHOUT "noper" naturally resumes that character instead of staying in raw mode.
export async function sendAsRawAI(
  channel: WebhookCapableChannel, displayName: string, text: string, personaIdToResume: string, mentionUserId?: string,
): Promise<string[] | null> {
  const webhook = await getOrCreateWebhook(channel);
  if (!webhook) return null;

  const chunks = withMentionPrefix(chunkText(text), mentionUserId);
  const messageIds: string[] = [];

  try {
    for (const chunk of chunks) {
      const sent = await webhook.send({ content: chunk, username: displayName });
      messageIds.push(sent.id);
      recordPersonaMessage(sent.id, personaIdToResume, channel.id);
    }
    return messageIds;
  } catch (err) {
    logger.error(`Webhook send failed in #${channel.name}`, err);
    return null;
  }
}

// Sends `text` through the channel's shared persona webhook, styled with the
// persona's name and avatar. Returns the sent message IDs, or null if webhooks
// aren't usable here (missing permission, etc.) — caller should fall back to a normal reply.
export async function sendAsPersona(
  channel: WebhookCapableChannel, persona: Persona, text: string, mentionUserId?: string,
): Promise<string[] | null> {
  const webhook = await getOrCreateWebhook(channel);
  if (!webhook) return null;

  const avatarURL = getAvatarUrl(persona.avatarKey);
  const chunks = withMentionPrefix(chunkText(text), mentionUserId);
  const messageIds: string[] = [];

  try {
    for (const chunk of chunks) {
      const sent = await webhook.send({
        content: chunk,
        username: persona.name,
        ...(avatarURL ? { avatarURL } : {}),
      });
      messageIds.push(sent.id);
      recordPersonaMessage(sent.id, persona.id, channel.id);
    }
    return messageIds;
  } catch (err) {
    logger.error(`Webhook send failed in #${channel.name}`, err);
    return null;
  }
}
