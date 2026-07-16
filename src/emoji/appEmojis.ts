import { Client, Message } from 'discord.js';
import { env } from '../env';
import { logger } from '../logger';

const cache = new Map<string, string>(); // name -> "<:name:id>" or "<a:name:id>"

export async function loadAppEmojis(client: Client): Promise<void> {
  try {
    if (!client.application) return;
    const emojis = await client.application.emojis.fetch();
    cache.clear();
    emojis.forEach(e => {
      if (!e.name) return;
      cache.set(e.name, e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`);
    });
    if (cache.size) logger.info(`App emojis loaded: ${[...cache.keys()].join(', ')}`);
    else logger.info('No app emojis found — upload some in Dev Portal → your app → Emojis tab.');
  } catch (err) {
    logger.warn('Could not load app emojis', err);
  }
}

export function resolveEmojis(text: string): string {
  return text.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => cache.get(name) ?? match);
}

export function buildEmojiContext(): string {
  if (!cache.size) return '';
  const list = [...cache.keys()].map(n => `:${n}:`).join(', ');
  return `You have access to these custom emojis. Use them by writing their name in colons, e.g. :wave:\nAvailable: ${list}\nUse them naturally and sparingly, only when they genuinely fit the mood.`;
}

export async function maybeReact(client: Client, message: Message): Promise<void> {
  if (!cache.size || Math.random() > env.REACTION_CHANCE) return;
  try {
    if (!client.application) return;
    const keys = [...cache.keys()];
    const name = keys[Math.floor(Math.random() * keys.length)];
    const emojis = await client.application.emojis.fetch();
    const emoji = emojis.find(e => e.name === name);
    if (emoji) await message.react(emoji);
  } catch {
    // best-effort — reactions should never crash the message flow
  }
}
