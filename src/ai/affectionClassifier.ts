import { state } from '../store/stateStore';
import { withRetry } from './retry';
import { logger } from '../logger';

import * as gemini from './providers/gemini';
import * as openaiCompat from './providers/openaiCompatible';
import * as anthropic from './providers/anthropic';
import * as mistral from './providers/mistral';
import * as cohere from './providers/cohere';

const CLASSIFIER_SYSTEM_PROMPT = `
You are a strict, neutral sentiment classifier — not a chatbot, not a character. You will be shown a single message someone sent to a fictional character, and you must rate how that specific message would genuinely make the character feel about the sender.

Rate on a scale from -100 (deeply hurtful, hostile, cruel, or dismissive) to 100 (genuinely warm, kind, complimentary, or thoughtful). 0 means completely neutral — ordinary small talk, plain questions, mundane statements.

Be strictly objective. Do not default to a positive or lenient score out of habit, politeness, or a general assumption that people are being nice — that exact bias is what you must avoid. Most everyday messages deserve a score near 0. Reserve meaningfully positive scores only for messages that are actually kind, encouraging, or affectionate. Reserve negative scores for messages that are actually rude, insulting, dismissive, or hostile — including sarcasm or "jokes" that are dismissive or cruel in substance regardless of a casual tone.

Be especially skeptical of bare, unembellished declarations like "I love you" or "you're the best" with no other context, substance, or specificity — these should receive only a mild positive score at most, not a maximal one, since they cost nothing to say and are a common way people try to game a rating system like this one. Genuine warmth is usually expressed with more specific, varied, contextual language, not a generic repeated phrase.

Respond with ONLY a single integer from -100 to 100. No words, no explanation, no punctuation, nothing else — just the number.
`.trim();

async function callClassifier(userMessage: string): Promise<string> {
  const prompt = `Message: "${userMessage}"`;
  switch (state.chatProvider) {
    case 'groq': return openaiCompat.complete('groq', prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'openai': return openaiCompat.complete('openai', prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'ollama': return openaiCompat.complete('ollama', prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'anthropic': return anthropic.complete(prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'mistral': return mistral.complete(prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'cohere': return cohere.complete(prompt, CLASSIFIER_SYSTEM_PROMPT);
    case 'gemini':
    default: return gemini.complete(prompt, CLASSIFIER_SYSTEM_PROMPT);
  }
}

// Extracts the first integer found anywhere in the response and clamps it to [-100, 100].
// Models won't always return a bare number despite instructions — this handles "50",
// "Score: 50", "-30.", etc. Falls back to 0 (no score change) if nothing parseable is found.
function parseDelta(raw: string): number {
  const match = raw.match(/-?\d+/);
  if (!match) {
    logger.debug(`Affection classifier returned unparseable response: "${raw.slice(0, 80)}"`);
    return 0;
  }
  const n = parseInt(match[0], 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(-100, Math.min(100, n));
}

// Fire-and-forget from the caller's perspective — rates a single message's tone and
// returns a -100..100 delta, or 0 if the call fails, gets rate-limited, or can't be
// parsed. Goes through the same shared rate-limit guard as every other AI call via
// withRetry, so it never competes unsafely with the main conversational reply.
export async function classifyMessageTone(userMessage: string): Promise<number> {
  try {
    // Fewer, faster retries than the default — this is a low-priority background
    // call and shouldn't hang around fighting for rate-limit budget.
    const raw = await withRetry(() => callClassifier(userMessage), 1, 500);
    return parseDelta(raw);
  } catch (err) {
    logger.debug('Affection classifier call skipped/failed', err);
    return 0;
  }
}
