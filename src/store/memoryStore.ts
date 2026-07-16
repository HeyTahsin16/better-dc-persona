import { readJSON, writeJSON } from './json';
import { MEMORIES_PATH } from '../constants';
import { MemoryStoreShape } from '../types';

const EMPTY_STORE: MemoryStoreShape = { global: [], personas: {} };

export function loadMemories(): MemoryStoreShape {
  const store = readJSON<MemoryStoreShape>(MEMORIES_PATH, EMPTY_STORE);
  if (!store.personas) store.personas = {}; // tolerate older/partial files
  if (!store.global) store.global = [];
  return store;
}

function save(store: MemoryStoreShape): void {
  writeJSON(MEMORIES_PATH, store);
}

// ─── Global facts — persona-agnostic, known to every persona about everyone ──────────

export function addGlobalMemory(fact: string): void {
  const store = loadMemories();
  store.global.push(fact);
  save(store);
}

export function removeGlobalMemoryByQuery(query: string): string | null {
  const store = loadMemories();
  const q = query.toLowerCase();
  const idx = store.global.findIndex(e => e.toLowerCase().includes(q));
  if (idx === -1) return null;
  const [removed] = store.global.splice(idx, 1);
  save(store);
  return removed;
}

// ─── Persona-scoped facts — only the specified persona knows these, about one user ──
// A memory added while Rem is the active persona is invisible to Asuna, and vice versa.

export function addPersonaMemory(personaId: string, userId: string, fact: string): void {
  const store = loadMemories();
  if (!store.personas[personaId]) store.personas[personaId] = {};
  if (!store.personas[personaId][userId]) store.personas[personaId][userId] = [];
  store.personas[personaId][userId].push(fact);
  save(store);
}

export function removePersonaMemoryByQuery(personaId: string, userId: string, query: string): string | null {
  const store = loadMemories();
  const entries = store.personas[personaId]?.[userId];
  if (!entries?.length) return null;
  const q = query.toLowerCase();
  const idx = entries.findIndex(e => e.toLowerCase().includes(q));
  if (idx === -1) return null;
  const [removed] = entries.splice(idx, 1);
  if (entries.length === 0) delete store.personas[personaId][userId];
  save(store);
  return removed;
}

export function listPersonaMemoriesForUser(personaId: string, userId: string): string[] {
  return loadMemories().personas[personaId]?.[userId] ?? [];
}

// userId -> fact count, for the "list all users this persona knows things about" view.
export function listPersonaUserSummary(personaId: string): Record<string, number> {
  const users = loadMemories().personas[personaId] ?? {};
  const summary: Record<string, number> = {};
  for (const [userId, facts] of Object.entries(users)) summary[userId] = facts.length;
  return summary;
}

// ─── System-prompt injection ──────────────────────────────────────────────────────────

export function buildMemoryBlock(userId: string, username: string, personaId: string): string {
  const store = loadMemories();
  const lines: string[] = [];

  if (store.global.length) {
    lines.push('== Things true about everyone (known to every persona) ==');
    store.global.forEach(e => lines.push(`• ${e}`));
  }

  const personaFacts = store.personas[personaId]?.[userId];
  if (personaFacts?.length) {
    lines.push(`== Things you specifically know about ${username} ==`);
    personaFacts.forEach(e => lines.push(`• ${e}`));
  }

  return lines.join('\n');
}
