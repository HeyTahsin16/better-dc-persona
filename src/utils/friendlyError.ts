import { ErrorMessages } from '../types';
import { env } from '../env';
import { getActivePersona } from '../ai/promptBuilder';
import { RateLimitGuardError } from '../ai/rateLimiter';

const DEFAULTS: Required<ErrorMessages> = {
  overloaded: env.ERROR_MSG_OVERLOADED || "i'm a bit overwhelmed right now, try again in a sec 😅",
  ratelimit: env.ERROR_MSG_RATELIMIT || "slow down a little, i need a breather 🥲",
  auth: env.ERROR_MSG_AUTH || "something's wrong on my end — ping the owner 🔧",
  notfound: env.ERROR_MSG_NOTFOUND || "that model doesn't seem to exist, an admin should check the config 🤔",
  fallback: env.ERROR_MSG_FALLBACK || "ran into a hiccup, try again in a moment 🔄",
};

interface ErrorLike {
  message?: string;
  status?: number;
  statusCode?: number;
  error?: { status?: number };
}

export function friendlyError(err: unknown): string {
  const persona = getActivePersona();
  const overrides = persona.errorMessages || {};
  const em = { ...DEFAULTS, ...overrides };

  if (err instanceof RateLimitGuardError) {
    const seconds = Math.ceil(err.retryAfterMs / 1000);
    return `${em.ratelimit} (protecting the API quota — try again in ~${seconds}s)`;
  }

  const e = err as ErrorLike;
  const msg = (e?.message || String(err) || '').toLowerCase();
  const status = e?.status || e?.statusCode || e?.error?.status || 0;

  if (status === 503 || msg.includes('503') || msg.includes('service unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
    return em.overloaded;
  }
  if (status === 429 || msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many requests')) {
    return em.ratelimit;
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('unauthorized') || msg.includes('authentication')) {
    return em.auth;
  }
  if (status === 404 || msg.includes('404') || msg.includes('not found') || msg.includes('no such model') || msg.includes('does not exist')) {
    return em.notfound;
  }
  return em.fallback;
}
