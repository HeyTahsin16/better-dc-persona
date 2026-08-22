import { readJSON, writeJSON } from './json';
import { CHANNEL_CONTEXT_PATH } from '../constants';
import { ChannelContextEntry, ChannelContextStoreShape } from '../types';

const EMPTY_STORE: ChannelContextStoreShape = {};

function load(): ChannelContextStoreShape {
  return readJSON<ChannelContextStoreShape>(CHANNEL_CONTEXT_PATH, EMPTY_STORE);
}

function save(store: ChannelContextStoreShape): void {
  writeJSON(CHANNEL_CONTEXT_PATH, store);
}

// This is a deliberately separate persistence tier from BOTH of the other two "what
// happened in this channel" concepts in the codebase:
//   - ai/history.ts's per-"channelId:personaId" turns: ephemeral (in-memory only),
//     cleared by /clear and /reload, isolated per persona.
//   - chatLogStore.ts's raw .jsonl log: permanent, complete, never cleared by anything.
// This one sits in between: persists across restarts like the log, but is a derived,
// lossy, resettable *summary* of it — so /logs forget can wipe it without touching the
// permanent record, the same way /clear already doesn't touch the log.
export function getChannelContext(channelId: string): ChannelContextEntry | null {
  return load()[channelId] ?? null;
}

export function getChannelSummaryText(channelId: string): string {
  return getChannelContext(channelId)?.summary ?? '';
}

export function saveChannelSummary(channelId: string, summary: string): void {
  const store = load();
  store[channelId] = { summary, updatedAt: new Date().toISOString() };
  save(store);
}

// Used by /logs forget. Returns whether there was actually something to remove, so the
// command can give an honest "nothing there" reply instead of a false-positive success.
export function forgetChannelSummary(channelId: string): boolean {
  const store = load();
  if (!store[channelId]) return false;
  delete store[channelId];
  save(store);
  return true;
}
