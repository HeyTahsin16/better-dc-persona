import { readJSON, writeJSON } from './json';
import path from 'path';
import { DATA_DIR } from '../constants';

const USER_PERSONAS_PATH = path.join(DATA_DIR, 'user_personas.json');

interface UserPersonaStoreShape {
  [userId: string]: string; // personaId
}

function load(): UserPersonaStoreShape {
  return readJSON<UserPersonaStoreShape>(USER_PERSONAS_PATH, {});
}

function save(store: UserPersonaStoreShape): void {
  writeJSON(USER_PERSONAS_PATH, store);
}

// Returns the user's personally-chosen persona ID, or undefined if they haven't set one
// (in which case callers should fall back to the server-wide default).
export function getUserPersonaId(userId: string): string | undefined {
  return load()[userId];
}

export function setUserPersonaId(userId: string, personaId: string): void {
  const store = load();
  store[userId] = personaId;
  save(store);
}

export function clearUserPersonaId(userId: string): boolean {
  const store = load();
  if (!(userId in store)) return false;
  delete store[userId];
  save(store);
  return true;
}
