import { readJSON, writeJSON } from './json';
import { TRIGGERS_PATH } from '../constants';
import { TriggerStoreShape } from '../types';

export function loadTriggers(): TriggerStoreShape {
  return readJSON<TriggerStoreShape>(TRIGGERS_PATH, {});
}

function save(store: TriggerStoreShape): void {
  writeJSON(TRIGGERS_PATH, store);
}

export function addTrigger(keyword: string, reply: string): number {
  const store = loadTriggers();
  const k = keyword.toLowerCase().trim();
  if (!store[k]) store[k] = [];
  store[k].push(reply);
  save(store);
  return store[k].length;
}

export type RemoveTriggerResult = 'deleted_keyword' | 'deleted_reply' | 'no_keyword' | 'no_index';

export function removeTrigger(keyword: string, index?: number): RemoveTriggerResult {
  const store = loadTriggers();
  const k = keyword.toLowerCase().trim();
  if (!store[k]) return 'no_keyword';
  if (index === undefined) {
    delete store[k];
    save(store);
    return 'deleted_keyword';
  }
  if (store[k][index] === undefined) return 'no_index';
  store[k].splice(index, 1);
  if (store[k].length === 0) delete store[k];
  save(store);
  return 'deleted_reply';
}

// Returns a matched reply (chosen at random if multiple exist) or null.
export function matchTrigger(text: string): string | null {
  const store = loadTriggers();
  const lowered = text.toLowerCase();
  for (const [keyword, replies] of Object.entries(store)) {
    if (!replies.length) continue;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    if (re.test(lowered)) {
      return replies[Math.floor(Math.random() * replies.length)];
    }
  }
  return null;
}
