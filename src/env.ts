import 'dotenv/config';

function str(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}
function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v.toLowerCase() === 'true';
}

export const env = {
  // Discord
  DISCORD_TOKEN: str('DISCORD_TOKEN'),
  CLIENT_ID: str('CLIENT_ID') || str('DISCORD_CLIENT_ID'),
  OWNER_ID: str('OWNER_ID'),

  // Chat providers
  GEMINI_API_KEY: str('GEMINI_API_KEY'),
  GROQ_API_KEY: str('GROQ_API_KEY'),
  OPENAI_API_KEY: str('OPENAI_API_KEY'),
  ANTHROPIC_API_KEY: str('ANTHROPIC_API_KEY'),
  MISTRAL_API_KEY: str('MISTRAL_API_KEY'),
  COHERE_API_KEY: str('COHERE_API_KEY'),
  OLLAMA_BASE_URL: str('OLLAMA_BASE_URL', 'http://localhost:11434'),

  // Image providers
  TOGETHER_API_KEY: str('TOGETHER_API_KEY'),
  STABILITY_API_KEY: str('STABILITY_API_KEY'),

  // Starting state
  AI_PROVIDER: str('AI_PROVIDER', 'gemini'),
  AI_MODEL: str('AI_MODEL'),
  IMAGE_PROVIDER: str('IMAGE_PROVIDER', 'gemini'),
  IMAGE_MODEL: str('IMAGE_MODEL'),
  DEFAULT_PERSONA: str('DEFAULT_PERSONA', 'asuna'),
  DEFAULT_TIMEZONE: str('DEFAULT_TIMEZONE', 'UTC'),

  // Access
  AUTHORIZED_USERS: str('AUTHORIZED_USERS'), // comma-separated, seeded as "normal" role

  // Behavior
  RESPOND_TO_ALL: bool('RESPOND_TO_ALL', false),
  MAX_HISTORY: num('MAX_HISTORY', 30),
  REACTION_CHANCE: num('REACTION_CHANCE', 0.3),

  // Safety ceiling on outgoing chat-provider calls per rolling 60s window. Once hit,
  // new calls are refused outright (not queued/delayed) rather than risking the
  // provider's own hard rate limit. Default 14 leaves a 1-call buffer under a 15 RPM tier.
  CHAT_RATE_LIMIT_PER_MINUTE: num('CHAT_RATE_LIMIT_PER_MINUTE', 14),

  // Logging / monitoring
  LOG_LEVEL: str('LOG_LEVEL', 'info'),
  LOG_TO_FILE: bool('LOG_TO_FILE', false),
  PORT: num('PORT', 3000),

  // Public URL for serving persona avatars to Discord's webhook API.
  // Explicit override takes priority; otherwise auto-detected from Railway's
  // generated domain (only present once you click "Generate Domain" in Railway's
  // Networking settings for this service).
  PUBLIC_URL: str('PUBLIC_URL'),
  RAILWAY_PUBLIC_DOMAIN: str('RAILWAY_PUBLIC_DOMAIN'),

  // Custom error message overrides
  ERROR_MSG_OVERLOADED: str('ERROR_MSG_OVERLOADED'),
  ERROR_MSG_RATELIMIT: str('ERROR_MSG_RATELIMIT'),
  ERROR_MSG_AUTH: str('ERROR_MSG_AUTH'),
  ERROR_MSG_NOTFOUND: str('ERROR_MSG_NOTFOUND'),
  ERROR_MSG_FALLBACK: str('ERROR_MSG_FALLBACK'),
};

export function requireEnv(): void {
  const missing: string[] = [];
  if (!env.DISCORD_TOKEN) missing.push('DISCORD_TOKEN');
  if (!env.CLIENT_ID) missing.push('CLIENT_ID');
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
