import { readJSON, writeJSON } from './json';
import path from 'path';
import { DATA_DIR } from '../constants';

const AFFECTION_PATH = path.join(DATA_DIR, 'affection.json');

interface AffectionRecord {
  score: number;
  lastUpdatedAt: string; // ISO timestamp
}

interface AffectionStoreShape {
  [key: string]: AffectionRecord; // key = "userId:personaId"
}

function recordKey(userId: string, personaId: string): string {
  return `${userId}:${personaId}`;
}

function load(): AffectionStoreShape {
  return readJSON<AffectionStoreShape>(AFFECTION_PATH, {});
}
function save(store: AffectionStoreShape): void {
  writeJSON(AFFECTION_PATH, store);
}

interface LevelBand {
  level: number;         // 1-5
  threshold: number;     // minimum |score| to reach this band
  dailyDecayRate: number; // fraction of score removed per day at this band
  positiveDescription: string;
  negativeDescription: string;
}

// At least 5 positive + 5 negative levels, per spec. Lower levels decay fast (a mild
// mood fades quickly); higher levels are dramatically more resistant to decay — level 5
// in particular is meant to feel close to permanent, since reaching it (in either
// direction) takes sustained, genuine effort and should be treated as earned, not
// something that quietly evaporates over a slow week. Thresholds anchor around the
// 10k / 100k marks mentioned when this was scoped out.
const LEVEL_BANDS: LevelBand[] = [
  {
    level: 1, threshold: 500, dailyDecayRate: 0.20,
    positiveDescription: "You've started to feel a little warmer toward this person than a stranger — nothing dramatic yet, just a good early impression.",
    negativeDescription: 'You feel a little put off by this person — nothing dramatic, just a mildly bad impression so far.',
  },
  {
    level: 2, threshold: 2_500, dailyDecayRate: 0.10,
    positiveDescription: 'You feel genuinely friendly and comfortable around this person.',
    negativeDescription: 'You feel guarded and a bit irritated around this person.',
  },
  {
    level: 3, threshold: 10_000, dailyDecayRate: 0.04,
    positiveDescription: 'You feel real warmth and fondness toward this person, built from a consistent pattern of good interactions.',
    negativeDescription: 'You feel real distrust and coldness toward this person, built from a consistent pattern of bad interactions.',
  },
  {
    level: 4, threshold: 30_000, dailyDecayRate: 0.01,
    positiveDescription: "You feel deep trust and affection toward this person — they've clearly earned a meaningful place in how you see them.",
    negativeDescription: 'You feel genuinely hurt and resentful toward this person.',
  },
  {
    level: 5, threshold: 100_000, dailyDecayRate: 0.0015,
    positiveDescription: 'You deeply cherish this person. Your warmth toward them should come through unmistakably in how you talk to them.',
    negativeDescription: 'You feel deeply wounded by this person and have little patience left for them — your guard should be clearly, unmistakably up.',
  },
];

const MAX_SCORE = 1_000_000; // sanity ceiling, not a meaningful design threshold
const UNBANDED_DECAY_RATE = 0.25; // sub-level-1 residue fades fast too

function bandForMagnitude(abs: number): LevelBand | null {
  let matched: LevelBand | null = null;
  for (const band of LEVEL_BANDS) {
    if (abs >= band.threshold) matched = band;
  }
  return matched;
}

function applyDecay(score: number, elapsedMs: number): number {
  if (score === 0 || elapsedMs <= 0) return score;
  const band = bandForMagnitude(Math.abs(score));
  const dailyRate = band?.dailyDecayRate ?? UNBANDED_DECAY_RATE;
  const elapsedDays = elapsedMs / 86_400_000;
  const retained = Math.pow(1 - dailyRate, elapsedDays);
  const next = score * retained;
  return Math.abs(next) < 1 ? 0 : next; // snap tiny residue to exactly 0
}

function getDecayedRecord(userId: string, personaId: string): AffectionRecord {
  const store = load();
  const raw = store[recordKey(userId, personaId)];
  if (!raw) return { score: 0, lastUpdatedAt: new Date().toISOString() };
  const elapsedMs = Date.now() - new Date(raw.lastUpdatedAt).getTime();
  return { score: applyDecay(raw.score, elapsedMs), lastUpdatedAt: raw.lastUpdatedAt };
}

export function getAffectionScore(userId: string, personaId: string): number {
  return getDecayedRecord(userId, personaId).score;
}

// -5 to +5, matching the band table above; 0 means neutral (below every threshold).
export function getAffectionLevel(userId: string, personaId: string): number {
  const score = getAffectionScore(userId, personaId);
  const band = bandForMagnitude(Math.abs(score));
  if (!band) return 0;
  return score < 0 ? -band.level : band.level;
}

// Applies decay for elapsed time first, then adds the new delta, then persists.
export function applyAffectionDelta(userId: string, personaId: string, delta: number): number {
  const decayed = getDecayedRecord(userId, personaId);
  const next = Math.max(-MAX_SCORE, Math.min(MAX_SCORE, decayed.score + delta));
  const store = load();
  store[recordKey(userId, personaId)] = { score: next, lastUpdatedAt: new Date().toISOString() };
  save(store);
  return next;
}

export function resetAffection(userId: string, personaId: string): void {
  const store = load();
  delete store[recordKey(userId, personaId)];
  save(store);
}

// Injected into the persona's system prompt — null at neutral (level 0) so the prompt
// isn't cluttered when there's nothing meaningful to say about the relationship yet.
export function getAffectionContextLine(userId: string, personaId: string): string | null {
  const score = getAffectionScore(userId, personaId);
  const band = bandForMagnitude(Math.abs(score));
  if (!band) return null;
  return score < 0 ? band.negativeDescription : band.positiveDescription;
}

// Casual, third-person, number-free phrasing for the public /affection mood command —
// deliberately vaguer than the admin-facing numeric view, since exact scores are more
// fun left unseen for people just checking in on how they're doing with a character.
const MOOD_PHRASES = new Map<number, (name: string) => string>([
  [5, name => `${name} is completely smitten with you.`],
  [4, name => `${name} clearly adores you.`],
  [3, name => `${name} is genuinely fond of you.`],
  [2, name => `${name} seems to like you.`],
  [1, name => `${name} seems to have a decent impression of you.`],
  [0, name => `${name} doesn't have any particular feelings about you yet.`],
  [-1, name => `${name} seems a little put off by you.`],
  [-2, name => `${name} seems irritated with you.`],
  [-3, name => `${name} clearly doesn't trust you.`],
  [-4, name => `${name} seems to resent you.`],
  [-5, name => `${name} wants nothing to do with you right now.`],
]);

export function getAffectionMoodPhrase(userId: string, personaId: string, personaName: string): string {
  const level = getAffectionLevel(userId, personaId);
  const phraseFn = MOOD_PHRASES.get(level) ?? MOOD_PHRASES.get(0)!;
  return phraseFn(personaName);
}
