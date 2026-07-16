import { readJSON, writeJSON } from './json';
import { AUTH_PATH } from '../constants';
import { AuthStoreShape, AuthRole } from '../types';
import { env } from '../env';

function load(): AuthStoreShape {
  const stored = readJSON<AuthStoreShape>(AUTH_PATH, { users: {} });

  // Seed from AUTHORIZED_USERS env var on first run (all seeded as "normal").
  const envIds = env.AUTHORIZED_USERS.split(',').map(s => s.trim()).filter(Boolean);
  let changed = false;
  for (const id of envIds) {
    if (!(id in stored.users)) {
      stored.users[id] = 'normal';
      changed = true;
    }
  }
  if (changed) writeJSON(AUTH_PATH, stored);
  return stored;
}

function save(store: AuthStoreShape): void {
  writeJSON(AUTH_PATH, store);
}

export function listAuthorized(): Array<{ id: string; role: AuthRole }> {
  const store = load();
  return Object.entries(store.users).map(([id, role]) => ({ id, role }));
}

export function getAuthRole(userId: string): AuthRole | null {
  const store = load();
  return store.users[userId] ?? null;
}

export function addAuthorized(userId: string, role: AuthRole): void {
  const store = load();
  store.users[userId] = role;
  save(store);
}

export function removeAuthorized(userId: string): boolean {
  const store = load();
  if (!(userId in store.users)) return false;
  delete store.users[userId];
  save(store);
  return true;
}
