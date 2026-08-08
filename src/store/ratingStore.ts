import { readJSON, writeJSON } from './json';
import path from 'path';
import { DATA_DIR } from '../constants';

const RATINGS_PATH = path.join(DATA_DIR, 'persona_ratings.json');

interface RatingRecord {
  rating: number; // 1-10
  ratedAt: string; // ISO timestamp
}

interface RatingStoreShape {
  [key: string]: RatingRecord; // key = `${userId}:${personaId}`
}

function load(): RatingStoreShape {
  return readJSON<RatingStoreShape>(RATINGS_PATH, {});
}

function save(store: RatingStoreShape): void {
  writeJSON(RATINGS_PATH, store);
}

function makeKey(userId: string, personaId: string): string {
  return `${userId}:${personaId}`;
}

// userId is always a pure-numeric Discord snowflake and personaId is always a plain
// camelCase string, so a simple first-colon split is unambiguous — no realistic id
// could contain a literal colon and cause a false split here.
function parseKey(key: string): { userId: string; personaId: string } | null {
  const idx = key.indexOf(':');
  if (idx === -1) return null;
  return { userId: key.slice(0, idx), personaId: key.slice(idx + 1) };
}

// Rating again overwrites the previous value rather than accumulating a second entry —
// one rating per user per persona, so a single person can't skew an average by
// re-rating repeatedly, and changing your mind later is just a normal re-rate.
export function setRating(userId: string, personaId: string, rating: number): number {
  const clamped = Math.max(1, Math.min(10, Math.round(rating)));
  const store = load();
  store[makeKey(userId, personaId)] = { rating: clamped, ratedAt: new Date().toISOString() };
  save(store);
  return clamped;
}

export function getUserRating(userId: string, personaId: string): number | null {
  const record = load()[makeKey(userId, personaId)];
  return record ? record.rating : null;
}

export interface PersonaRatingStats {
  average: number;
  count: number;
}

// Null (not a zeroed-out stats object) when nobody has rated this persona yet — callers
// should treat that as "no reviews" and show a fallback, not "average of zero".
export function getPersonaRatingStats(personaId: string): PersonaRatingStats | null {
  const store = load();
  const ratings: number[] = [];
  for (const [key, record] of Object.entries(store)) {
    const parsed = parseKey(key);
    if (parsed?.personaId === personaId) ratings.push(record.rating);
  }
  if (!ratings.length) return null;
  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { average, count: ratings.length };
}

export interface LeaderboardEntry {
  personaId: string;
  average: number;
  count: number;
}

// Sorted by average descending; ties broken by rating count descending (more ratings
// backing the same average reads as more "proven"). Personas with zero ratings simply
// don't appear — a leaderboard is inherently about ranking the ones that HAVE been
// rated, not padding the list with unrated entries.
export function getLeaderboard(): LeaderboardEntry[] {
  const store = load();
  const byPersona = new Map<string, number[]>();
  for (const [key, record] of Object.entries(store)) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    if (!byPersona.has(parsed.personaId)) byPersona.set(parsed.personaId, []);
    byPersona.get(parsed.personaId)!.push(record.rating);
  }
  const entries: LeaderboardEntry[] = [...byPersona.entries()].map(([personaId, ratings]) => ({
    personaId,
    average: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    count: ratings.length,
  }));
  entries.sort((a, b) => b.average - a.average || b.count - a.count);
  return entries;
}
