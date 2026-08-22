import { env } from '../env';
import { state } from '../store/stateStore';
import { withRetry } from './retry';
import { readLog } from '../store/chatLogStore';
import { getChannelContext, getChannelSummaryText, saveChannelSummary } from '../store/channelContextStore';
import { ChatLogEntry } from '../types';
import { logger } from '../logger';

import * as gemini from './providers/gemini';
import * as openaiCompat from './providers/openaiCompatible';
import * as anthropic from './providers/anthropic';
import * as mistral from './providers/mistral';
import * as cohere from './providers/cohere';

// ─── Cross-persona channel awareness ──────────────────────────────────────────────────
//
// Problem this solves: ai/history.ts's conversation memory is keyed "channelId:personaId",
// so a persona that's never spoken in a given channel before starts completely blind to
// it — even if five other personas (or the raw log) have been talking there for weeks.
// A persona in that position doesn't say "I don't know" — it fills the gap in character,
// which reads as confidently making things up.
//
// Fix: maintain ONE compressed, persona-agnostic rolling summary per channel (persisted
// via store/channelContextStore.ts) and inject it into every persona's system prompt.
// The summary — not raw log lines — is what's injected, and its length is capped, so the
// per-message token cost stays flat regardless of how old or busy the channel is. The
// summary itself is refreshed by a single cheap one-shot AI call that runs in the
// background (fire-and-forget, same pattern as affectionClassifier.ts) every
// CHANNEL_SUMMARY_INTERVAL messages, never on every message.
//
// On top of the always-on summary, a cheap regex check (no AI call) looks for "catch me
// up" style questions and, only then, pulls a larger literal excerpt from the real log
// for that one reply — precision on demand, without paying for it on every message.

const SUMMARY_SOURCE_LINES = 30; // how many raw log lines feed each refresh
const SUMMARY_MAX_CHARS = 900; // defensive hard cap, in case the model ignores the word-count instruction below
const FIRST_SUMMARY_THRESHOLD = Math.min(4, env.CHANNEL_SUMMARY_INTERVAL); // get a channel's very first summary out sooner than the steady-state interval
const RECALL_EXCERPT_LINES = 20;
const RECALL_ENTRY_MAX_CHARS = 280;

const CHANNEL_SUMMARIZER_SYSTEM_PROMPT = `
You maintain a short rolling summary of an ongoing Discord channel's conversation, for other AI characters who may join the conversation later and need to be caught up quickly.

You'll be given the existing summary (may say "none yet" if this is the first one) and a batch of the most recent raw messages from the channel. Write a fresh, complete, updated summary that merges the new messages into the existing one — don't just append, actually compress and fold them together.

Rules:
- Third person, neutral, factual. Describe what was discussed — don't roleplay or adopt anyone's voice.
- Prioritize: named topics, ongoing threads or open questions, running jokes/callbacks, anything a newcomer would need to know to not seem clueless.
- Skip greetings, small talk, and filler that won't matter a few messages later.
- Stay under 130 words. Be dense — this gets shown to every character on every single reply, so every word has a recurring cost.
- Plain prose or terse bullet points, whichever is more compact. No headers, no preamble like "Here is the summary."
`.trim();

// In-memory only, deliberately — same tradeoff ai/history.ts already makes for
// conversation turns. Losing this on restart just means the next refresh takes one
// extra interval to trigger; it's not a correctness problem, and avoids re-reading and
// re-parsing a channel's whole log file on every single message just to count lines.
const pendingSinceSummary = new Map<string, number>();

function formatLogForPrompt(entries: ChatLogEntry[]): string {
  return entries.map(e => `${e.username}: ${e.content}`).join('\n');
}

function buildSummarizerPrompt(existingSummary: string, entries: ChatLogEntry[]): string {
  return [
    existingSummary ? `Existing summary:\n${existingSummary}` : 'Existing summary: none yet — this is the first one.',
    '',
    `Recent messages:\n${formatLogForPrompt(entries)}`,
  ].join('\n');
}

// Trims to a hard character ceiling on a word boundary — belt-and-suspenders alongside
// the prompt's own word-count instruction, since a model ignoring instructions
// shouldn't be able to make this block grow without bound.
function clampSummary(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SUMMARY_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, SUMMARY_MAX_CHARS).replace(/\s+\S*$/, '')}…`;
}

async function callSummarizer(prompt: string): Promise<string> {
  switch (state.chatProvider) {
    case 'groq': return openaiCompat.complete('groq', prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'openai': return openaiCompat.complete('openai', prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'ollama': return openaiCompat.complete('ollama', prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'anthropic': return anthropic.complete(prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'mistral': return mistral.complete(prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'cohere': return cohere.complete(prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
    case 'gemini':
    default: return gemini.complete(prompt, CHANNEL_SUMMARIZER_SYSTEM_PROMPT);
  }
}

// Fire-and-forget from every caller's perspective — never throws, never blocks a reply.
// Pulls a bounded tail of the real log (not "everything since last time," which would
// need its own persisted cursor) and asks the model to fold it into the existing summary.
// Re-summarizing a bit of overlap on every refresh is intentional: it's simpler and more
// self-healing than tracking an exact cursor, at a cost that's still bounded by
// SUMMARY_SOURCE_LINES regardless.
export async function refreshChannelSummary(channelId: string): Promise<void> {
  try {
    const entries = readLog(channelId, SUMMARY_SOURCE_LINES);
    if (!entries.length) return;

    const existing = getChannelSummaryText(channelId);
    const prompt = buildSummarizerPrompt(existing, entries);
    // Fewer, faster retries than the default — same reasoning as the affection
    // classifier: a low-priority background refresh shouldn't fight the user-facing
    // reply for rate-limit budget.
    const raw = await withRetry(() => callSummarizer(prompt), 1, 500);
    const summary = clampSummary(raw);
    if (summary) saveChannelSummary(channelId, summary);
  } catch (err) {
    logger.debug('Channel summary refresh failed/skipped', err);
  }
}

// Call once per logged exchange (chatRouter.ts, right after appendLog — each exchange is
// 2 log lines: one user, one model). Cheap, synchronous bookkeeping; only actually kicks
// off an AI call once the threshold is crossed.
export function noteChannelExchangeLogged(channelId: string): void {
  if (!env.CHANNEL_CONTEXT_ENABLED) return;

  const pending = (pendingSinceSummary.get(channelId) ?? 0) + 2;
  const hasExistingSummary = !!getChannelContext(channelId);
  const threshold = hasExistingSummary ? env.CHANNEL_SUMMARY_INTERVAL : FIRST_SUMMARY_THRESHOLD;

  if (pending < threshold) {
    pendingSinceSummary.set(channelId, pending);
    return;
  }

  pendingSinceSummary.set(channelId, 0);
  void refreshChannelSummary(channelId);
}

// ─── On-demand recall: "catch me up" style questions ──────────────────────────────────

// Cheap, best-effort pattern match — no AI call needed just to decide whether to look
// closer. False negatives are fine (the always-on summary above still applies, which is
// already strictly better than the previous "nothing at all"); false positives just mean
// an occasional slightly larger, still-bounded prompt.
const RECALL_PATTERNS: RegExp[] = [
  /\bwhat('?s| is| was| were| did)\b.{0,40}\b(talk(?:ing)?|say(?:ing)?|said|happen(?:ing|ed)?|goin?g on|on about|about|miss(?:ed)?)\b/i,
  /\bcatch (?:me|us) up\b/i,
  /\bfill (?:me|us) in\b/i,
  /\brecap\b/i,
  /\bwhat did (?:i|we) miss\b/i,
  /\bwhat happened\b/i,
  /\bremind me what\b/i,
];

export function looksLikeRecallQuery(text: string): boolean {
  return RECALL_PATTERNS.some(re => re.test(text));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildRecallExcerpt(channelId: string): string | null {
  const entries = readLog(channelId, RECALL_EXCERPT_LINES);
  if (!entries.length) return null;
  return entries.map(e => `${e.username}: ${truncate(e.content, RECALL_ENTRY_MAX_CHARS)}`).join('\n');
}

// The single entry point promptBuilder.ts calls. Returns null (nothing to inject, no
// token cost at all) if the feature is disabled or there's genuinely nothing yet for
// this channel.
export function buildChannelAwarenessBlock(channelId: string, userText: string): string | null {
  if (!env.CHANNEL_CONTEXT_ENABLED) return null;

  const blocks: string[] = [];

  const summary = getChannelSummaryText(channelId);
  if (summary) {
    blocks.push(
      "Recent context from this Discord channel (a compressed recap of what's been going " +
      'on lately, including things said to or by OTHER characters — you know this the way ' +
      "you'd know something you were filled in on, not because you personally said all of " +
      `it):\n${summary}`,
    );
  }

  if (looksLikeRecallQuery(userText)) {
    const excerpt = buildRecallExcerpt(channelId);
    if (excerpt) {
      blocks.push(
        'The person just asked something that sounds like they want to be caught up on ' +
        'recent conversation. Here are the actual most recent messages in this channel, ' +
        `for precise reference — use these rather than guessing:\n${excerpt}`,
      );
    }
  }

  return blocks.length ? blocks.join('\n\n') : null;
}
