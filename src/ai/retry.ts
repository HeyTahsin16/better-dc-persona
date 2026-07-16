import { logger } from '../logger';
import { guardChatRateLimit } from './rateLimiter';

interface ErrLike { message?: string; status?: number; statusCode?: number; error?: { status?: number } }

function isTransient(err: unknown): boolean {
  const e = err as ErrLike;
  const msg = (e?.message || '').toLowerCase();
  const status = e?.status || e?.statusCode || e?.error?.status || 0;
  return status === 503 || status === 429 ||
    msg.includes('503') || msg.includes('429') ||
    msg.includes('overloaded') || msg.includes('high demand') ||
    msg.includes('rate limit') || msg.includes('too many requests');
}

// Retries transient (overloaded / rate-limited) errors with short backoff.
// Non-transient errors are thrown immediately. Every attempt (including retries) first
// passes through the local rate-limit guard — this is the single choke point every AI
// call in the bot goes through, so the per-minute ceiling is enforced everywhere for free.
export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    guardChatRateLimit(); // throws RateLimitGuardError immediately if tripped — never caught/retried below, on purpose
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === retries) throw err;
      logger.warn(`Transient AI error, retrying (attempt ${attempt + 1}/${retries})`, err);
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
