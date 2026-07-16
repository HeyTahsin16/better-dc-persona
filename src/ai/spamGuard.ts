// Prevents gaming the affection meter by spamming the same (or near-identical) message
// repeatedly — e.g. sending "I love you" over and over. Purely in-memory and short-window
// on purpose: this is meant to catch rapid-fire spam within a session, not to punish
// someone for genuinely expressing warmth more than once across a normal day.

interface TrackedMessage {
  text: string;
  timestamp: number;
}

const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_TRACKED = 8;
const SIMILARITY_THRESHOLD = 0.5;
const DAMPENING_BASE = 0.35; // each additional near-duplicate cuts the multiplier further

const recentByUserPersona = new Map<string, TrackedMessage[]>();

function key(userId: string, personaId: string): string {
  return `${userId}:${personaId}`;
}

function normalizeToWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Returns a 0-1 multiplier to scale a POSITIVE affection delta by, based on how similar
// this message is to the sender's recent messages toward this same persona. Sharply
// diminishing — repeat the same sentiment a few times in a short window and it stops
// earning anything meaningful. Only meant to be applied to positive deltas; negative
// spam (repeated hostility) is left alone on purpose, since there's no exploit to close there.
export function getRepetitionDampening(userId: string, personaId: string, messageText: string): number {
  const k = key(userId, personaId);
  const now = Date.now();
  const history = (recentByUserPersona.get(k) ?? []).filter(m => now - m.timestamp < RECENT_WINDOW_MS);

  const currentWords = normalizeToWords(messageText);
  let repeatCount = 0;
  for (const past of history) {
    if (jaccardSimilarity(currentWords, normalizeToWords(past.text)) >= SIMILARITY_THRESHOLD) repeatCount++;
  }

  history.push({ text: messageText, timestamp: now });
  recentByUserPersona.set(k, history.slice(-MAX_TRACKED));

  return Math.pow(DAMPENING_BASE, repeatCount);
}
