import { TextChannel, NewsChannel, VoiceChannel, StageChannel, AnyThreadChannel, Channel, Webhook, WebhookType } from 'discord.js';
import { logger } from '../logger';
import { getAvatarUrl } from './avatarResolver';
import { Persona } from '../types';
import { recordPersonaMessage } from './threadTracker';
import { chunkText } from '../utils/chunk';

// Channels a persona reply might be sent to. Threads don't own a webhook of
// their own (Discord's API has no such thing) — sending into a thread means
// using its PARENT's webhook with `threadId` set. Voice channels, on the
// other hand, genuinely do support their own webhook directly, same as a
// normal text channel, so they need no special-casing beyond being included
// in this type — only threads need the parent-resolution below.
export type WebhookCapableChannel = TextChannel | NewsChannel | VoiceChannel | StageChannel | AnyThreadChannel;
type WebhookHost = TextChannel | NewsChannel | VoiceChannel | StageChannel;

// Single canonical type-guard for "can we try sending a persona-styled webhook message
// here" — exported so every caller (messageCreate.ts, reminders.ts, anything future)
// shares this one implementation instead of each keeping its own copy. Two independent
// copies of this exact check existing (one updated, one stale) is literally how threads
// and voice channels ended up unsupported in reminders after already being fixed
// everywhere else — not repeating that. Accepts null/undefined directly since the most
// common caller pattern is straight off a `.fetch()` call, which can return either.
export function isWebhookCapableChannel(channel: Channel | null | undefined): channel is WebhookCapableChannel {
  if (!channel) return false;
  return channel instanceof TextChannel || channel instanceof NewsChannel
    || channel instanceof VoiceChannel || channel instanceof StageChannel
    || channel.isThread();
}

const WEBHOOK_NAME = 'Persona Relay';
const webhookCache = new Map<string, Webhook<WebhookType.Incoming>>(); // hostChannelId -> webhook

// A thread's messages are hosted by its parent channel's webhook (with `threadId`
// set at send time) — the thread itself has no fetchWebhooks()/createWebhook() of
// its own. Everything else can own a webhook directly.
function resolveWebhookHost(channel: WebhookCapableChannel): WebhookHost | null {
  if (!channel.isThread()) return channel;
  const parent = channel.parent;
  return parent instanceof TextChannel || parent instanceof NewsChannel ? parent : null;
}

async function getOrCreateWebhook(channel: WebhookCapableChannel): Promise<Webhook<WebhookType.Incoming> | null> {
  const host = resolveWebhookHost(channel);
  if (!host) return null; // e.g. a thread whose parent is a forum/media channel — no webhook home to use

  const cached = webhookCache.get(host.id);
  if (cached) return cached;

  try {
    const existing = await host.fetchWebhooks();
    let webhook = existing.find(w => w.name === WEBHOOK_NAME && w.isIncoming());
    if (!webhook) {
      webhook = await host.createWebhook({ name: WEBHOOK_NAME, reason: 'Persona relay for AI character replies' });
      logger.info(`Created persona webhook in #${host.name}`);
    }
    webhookCache.set(host.id, webhook as Webhook<WebhookType.Incoming>);
    return webhook as Webhook<WebhookType.Incoming>;
  } catch (err) {
    logger.error(`Could not get/create a webhook in #${host.name} — check the bot has "Manage Webhooks" permission`, err);
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

  const threadId = channel.isThread() ? channel.id : undefined;
  const chunks = withMentionPrefix(chunkText(text), mentionUserId);
  const messageIds: string[] = [];

  try {
    for (const chunk of chunks) {
      const sent = await webhook.send({ content: chunk, username: displayName, ...(threadId ? { threadId } : {}) });
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
  const threadId = channel.isThread() ? channel.id : undefined;
  const chunks = withMentionPrefix(chunkText(text), mentionUserId);
  const messageIds: string[] = [];

  try {
    for (const chunk of chunks) {
      const sent = await webhook.send({
        content: chunk,
        username: persona.name,
        ...(avatarURL ? { avatarURL } : {}),
        ...(threadId ? { threadId } : {}),
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
