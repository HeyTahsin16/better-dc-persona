import { state } from '../store/stateStore';
import { env } from '../env';
import { logger } from '../logger';

const WINDOW_MS = 60_000;

interface WindowState {
  provider: string;
  windowStartMs: number;
  count: number;
}

let current: WindowState = { provider: state.chatProvider, windowStartMs: Date.now(), count: 0 };

export class RateLimitGuardError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Chat rate-limit guard tripped — retry in ~${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'RateLimitGuardError';
    this.retryAfterMs = retryAfterMs;
  }
}

function resetIfStale(): void {
  const now = Date.now();
  if (current.provider !== state.chatProvider || now - current.windowStartMs >= WINDOW_MS) {
    current = { provider: state.chatProvider, windowStartMs: now, count: 0 };
  }
}

// Called once per real outgoing request attempt (including retries) to the active chat
// provider — see ai/retry.ts, which is the single place this gets invoked from, so every
// call path (main replies, one-shot completions, the affection classifier) is covered
// automatically. Throws BEFORE the request is made once the configured per-minute ceiling
// is reached, since the goal is to never actually reach the provider's own hard rate
// limit — that risks worse consequences (temporary blocks) than just waiting a few seconds.
export function guardChatRateLimit(): void {
  resetIfStale();
  if (current.count >= env.CHAT_RATE_LIMIT_PER_MINUTE) {
    const retryAfterMs = Math.max(WINDOW_MS - (Date.now() - current.windowStartMs), 0);
    logger.warn(`Rate limit guard tripped for ${current.provider}: ${current.count}/${env.CHAT_RATE_LIMIT_PER_MINUTE} this minute`);
    throw new RateLimitGuardError(retryAfterMs);
  }
  current.count += 1;
}

export function getRateLimitStatus(): { provider: string; used: number; limit: number; resetInMs: number } {
  resetIfStale();
  return {
    provider: current.provider,
    used: current.count,
    limit: env.CHAT_RATE_LIMIT_PER_MINUTE,
    resetInMs: Math.max(WINDOW_MS - (Date.now() - current.windowStartMs), 0),
  };
}
