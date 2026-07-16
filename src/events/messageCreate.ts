import { Message, ChannelType, TextChannel, NewsChannel } from 'discord.js';
import { env } from '../env';
import { isAuthorized } from '../permissions/roles';
import { matchTrigger } from '../store/triggerStore';
import { resolveEmojis, maybeReact } from '../emoji/appEmojis';
import { getAIResponse, getAIResponseWithImage, getRawAIResponse } from '../ai/chatRouter';
import { resolvePersonaForUser, getActivePersona } from '../ai/promptBuilder';
import { getPersona } from '../personas';
import { getPersonaForMessage } from '../webhooks/threadTracker';
import { sendAsPersona, sendAsRawAI } from '../webhooks/webhookManager';
import { activeChatModel } from '../store/stateStore';
import { humanizeModelName } from '../utils/humanize';
import { friendlyError } from '../utils/friendlyError';
import { chunkText } from '../utils/chunk';
import { logger } from '../logger';
import { Persona } from '../types';
import { getOpenChannelId } from '../store/openChannelStore';
import { classifyMessageTone } from '../ai/affectionClassifier';
import { applyAffectionDelta } from '../store/affectionStore';
import { getRepetitionDampening } from '../ai/spamGuard';

// Prefix that breaks character entirely for one message — "noper what's the boiling
// point of water in Fahrenheit?" — always required, never sticky via reply-threading.
// \b ensures "noperson" etc. doesn't false-trigger.
const NOPER_PATTERN = /^noper\b\s*/i;

function stripNoperPrefix(text: string): { isRaw: boolean; query: string } {
  const match = text.match(NOPER_PATTERN);
  if (!match) return { isRaw: false, query: text };
  return { isRaw: true, query: text.slice(match[0].length).trim() };
}

function isWebhookCapable(channel: Message['channel']): channel is TextChannel | NewsChannel {
  return channel instanceof TextChannel || channel instanceof NewsChannel;
}

async function sendPlainReply(message: Message, text: string): Promise<void> {
  if (!message.channel.isSendable()) return;
  const chunks = chunkText(text);
  let first = true;
  for (const chunk of chunks) {
    if (first) { await message.reply(chunk); first = false; }
    else { await message.channel.send(chunk); }
  }
}

// Tries to send styled as `persona` via the channel's shared webhook, @mentioning
// whoever this is responding to (webhooks can't do native Discord replies — see README).
// Falls back to a plain bot-identity reply for DMs or if webhooks aren't usable here.
async function respondAsPersona(message: Message, persona: Persona, text: string): Promise<void> {
  if (isWebhookCapable(message.channel)) {
    const sent = await sendAsPersona(message.channel, persona, text, message.author.id);
    if (sent) return;
  }
  await sendPlainReply(message, text);
}

// Same idea, but styled as the active AI model with no avatar (raw/"noper" mode).
// `personaToResume` is tracked so a later reply without "noper" resumes that character.
async function respondAsRawAI(message: Message, displayName: string, text: string, personaToResume: Persona): Promise<void> {
  if (isWebhookCapable(message.channel)) {
    const sent = await sendAsRawAI(message.channel, displayName, text, personaToResume.id, message.author.id);
    if (sent) return;
  }
  await sendPlainReply(message, text);
}

// Silent, non-blocking — rates this message's tone and updates the sender's standing
// with `persona` accordingly. Runs after the reply is already sent so it never adds
// latency, and any failure (including the rate-limit guard tripping) is swallowed here
// since this is a background mechanic, not core functionality. Positive deltas get
// dampened if the message is a near-duplicate of something recently sent to this same
// persona — closes the "just spam I love you" way of farming affection for free.
function updateAffectionInBackground(userId: string, persona: Persona, userMessage: string): void {
  void (async () => {
    try {
      let delta = await classifyMessageTone(userMessage);
      if (delta > 0) {
        const dampening = getRepetitionDampening(userId, persona.id, userMessage);
        delta = Math.round(delta * dampening);
      }
      if (delta !== 0) applyAffectionDelta(userId, persona.id, delta);
    } catch (err) {
      logger.debug('Affection update skipped', err);
    }
  })();
}

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return; // also correctly skips our own persona webhook messages, avoiding loops
  const botUser = message.client.user;
  if (!botUser) return;
  if (!message.channel.isSendable()) return;

  const isDM = message.channel.type === ChannelType.DM;
  const botMentioned = message.mentions.has(botUser);

  // The designated "open" channel (see /openchannel): anyone can talk here, authorized
  // or not, and only the server-wide default persona ever responds — personal picks
  // and thread-based persona continuation are both deliberately ignored in this channel,
  // so it behaves like a consistent, no-setup trial experience.
  const openChannelId = getOpenChannelId();
  const isOpenChannel = !!openChannelId && message.channelId === openChannelId;

  // Resolve whether this is a reply to one of our persona webhook messages (preferred,
  // tells us exactly which character to continue as) or a plain reply to the bot's own
  // identity (legacy fallback, e.g. if webhooks aren't set up) — check the cheap in-memory
  // tracker first and only fetch the referenced message if that lookup misses. Skipped
  // entirely in the open channel, since thread continuation doesn't apply there.
  let threadPersonaId: string | undefined;
  let isReplyToBotDirectly = false;
  if (!isOpenChannel && message.reference?.messageId) {
    const tracked = getPersonaForMessage(message.reference.messageId);
    if (tracked) {
      threadPersonaId = tracked.personaId;
    } else {
      const referenced = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      isReplyToBotDirectly = referenced?.author?.id === botUser.id;
    }
  }
  const isContinuingThread = !!threadPersonaId || isReplyToBotDirectly;

  if (!isOpenChannel && !botMentioned && !isDM && !isContinuingThread && !env.RESPOND_TO_ALL) return;
  // The open channel is the one place the authorization gate is deliberately skipped.
  if (!isOpenChannel && !isAuthorized(message.author.id)) return;

  const userMessage = message.content.replace(`<@${botUser.id}>`, '').trim();
  const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
  if (!userMessage && !imageAttachment) return;

  const persona = isOpenChannel
    ? getActivePersona()
    : (threadPersonaId ? (getPersona(threadPersonaId) ?? resolvePersonaForUser(message.author.id)) : resolvePersonaForUser(message.author.id));

  // "noper" always breaks character for exactly this one message — checked before
  // triggers/persona AI, and never persists via reply-threading (must be re-typed
  // every time). Replying to a raw-AI message WITHOUT "noper" naturally falls back to
  // resolving `persona` normally above, since the tracker still points at that character.
  const { isRaw, query } = stripNoperPrefix(userMessage);
  if (isRaw) {
    if (!query) {
      await message.reply("Add a question after `noper` — e.g. `noper what's the boiling point of water in Fahrenheit?`");
      return;
    }
    await message.channel.sendTyping();
    try {
      const reply = await getRawAIResponse(query);
      const displayName = humanizeModelName(activeChatModel());
      await respondAsRawAI(message, displayName, resolveEmojis(reply), persona);
      await maybeReact(message.client, message);
    } catch (err) {
      logger.error('Raw AI error handling message', err);
      await message.reply(friendlyError(err));
    }
    return;
  }

  // Keyword triggers only fire on direct engagement, never on RESPOND_TO_ALL ambient messages.
  if (botMentioned || isDM || isContinuingThread || isOpenChannel) {
    const triggerReply = matchTrigger(userMessage);
    if (triggerReply) {
      await respondAsPersona(message, persona, resolveEmojis(triggerReply));
      await maybeReact(message.client, message);
      return;
    }
  }

  await message.channel.sendTyping();
  try {
    let reply: string;
    if (imageAttachment) {
      const res = await fetch(imageAttachment.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      reply = await getAIResponseWithImage(
        message.channelId,
        userMessage || 'What do you see in this image?',
        message.author.id,
        message.author.username,
        buffer,
        imageAttachment.contentType!,
        persona,
      );
    } else {
      reply = await getAIResponse(message.channelId, userMessage, message.author.id, message.author.username, persona);
    }
    await respondAsPersona(message, persona, resolveEmojis(reply));
    await maybeReact(message.client, message);
    updateAffectionInBackground(message.author.id, persona, userMessage);
  } catch (err) {
    logger.error('AI error handling message', err);
    await message.reply(friendlyError(err));
  }
}
