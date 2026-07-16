import path from 'path';
import { ChatProviderName, ImageProviderName } from './types';

// ─── Paths (relative to process.cwd(), which is the repo root both in dev
// via tsx and in prod via `node dist/index.js` run from the project root) ────

export const DATA_DIR = path.join(process.cwd(), 'data');
export const AVATARS_DIR = path.join(process.cwd(), 'avatars');

// The designated "neutral" persona — used for welcome messages regardless of whatever
// persona is currently active for conversations (/persona set doesn't affect this).
// Chosen as the most broadly approachable, even-keeled personality of the roster.
export const NEUTRAL_PERSONA_ID = 'asuna';
export const AUTH_PATH = path.join(DATA_DIR, 'authorized.json');
export const MEMORIES_PATH = path.join(DATA_DIR, 'memories.json');
export const STATE_PATH = path.join(DATA_DIR, 'state.json');
export const TRIGGERS_PATH = path.join(DATA_DIR, 'triggers.json');
export const REMINDERS_PATH = path.join(DATA_DIR, 'reminders.json');
export const WELCOME_PATH = path.join(DATA_DIR, 'welcome.json');
export const CHAT_LOG_DIR = path.join(DATA_DIR, 'logs');
export const SYSTEM_LOG_DIR = path.join(DATA_DIR, 'logs', 'system');

// ─── Chat provider catalog ────────────────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<ChatProviderName, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  mistral: 'mistral-small-latest',
  cohere: 'command-r',
  ollama: 'llama3',
};

// Gemini 1.5 and bare "gemini-pro" are deprecated/prohibited by Google as of 2026 — omitted deliberately.
export const FREE_MODELS: Record<ChatProviderName, string[]> = {
  gemini: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'llama3-8b-8192', 'llama3-70b-8192'],
  openai: ['gpt-4o-mini'],
  anthropic: ['claude-3-5-haiku-latest', 'claude-3-haiku-20240307'],
  mistral: ['mistral-small-latest', 'open-mistral-7b', 'open-mixtral-8x7b'],
  cohere: ['command-r', 'command-light'],
  ollama: ['llama3', 'mistral', 'phi3', 'gemma2'],
};

// Providers whose chat API natively accepts image input alongside text.
export const NATIVE_VISION_PROVIDERS = new Set<ChatProviderName>(['gemini', 'openai', 'anthropic']);

// ─── Image provider catalog ───────────────────────────────────────────────
// "gemini" here uses Gemini's native "Nano Banana" image models via generateContent —
// NOT the standalone Imagen API, which Google is retiring in August 2026.

export const IMAGE_PROVIDER_DEFAULTS: Record<ImageProviderName, string> = {
  gemini: 'gemini-2.5-flash-image',
  together: 'black-forest-labs/FLUX.1-schnell-Free',
  'openai-dall-e': 'dall-e-3',
  stability: 'stable-diffusion-xl-1024-v1-0',
  none: '',
};

export const CHAT_PROVIDER_NAMES = Object.keys(PROVIDER_DEFAULTS) as ChatProviderName[];
export const IMAGE_PROVIDER_NAMES = Object.keys(IMAGE_PROVIDER_DEFAULTS) as ImageProviderName[];
