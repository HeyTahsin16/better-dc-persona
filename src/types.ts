// ─── Roles ──────────────────────────────────────────────────────────────────

export enum Role {
  NONE = 0,
  USER = 1,
  ADMIN = 2,
  OWNER = 3,
}

export type AuthRole = 'normal' | 'admin';

// ─── Persona ────────────────────────────────────────────────────────────────

export interface ErrorMessages {
  overloaded?: string;
  ratelimit?: string;
  auth?: string;
  notfound?: string;
  fallback?: string;
}

export interface Persona {
  id: string;
  name: string;
  source: string;
  description: string;
  traits: string[];
  tone: string;
  rules: string[];
  extraContext?: string;
  status?: string;
  errorMessages?: ErrorMessages;
  // Filename (without extension) to look up in the /avatars folder, e.g. "violet_evergarden"
  // matches avatars/violet_evergarden.png (or .gif/.jpg/.webp).
  avatarKey: string;
  // Which bot version introduced this persona, e.g. "v3.0" — powers the optional
  // "browse by version" filter in /persona set and /mypersona set. Purely organizational,
  // has no runtime effect on the persona's behavior.
  addedInVersion: string;
  // Replaces the default "1-5 sentences" length rule entirely for this persona.
  // Only set this when the default genuinely doesn't fit the character (e.g. someone
  // whose whole personality is about struggling to speak at all).
  responseLengthOverride?: string;
}

// ─── AI providers ───────────────────────────────────────────────────────────

export type ChatProviderName =
  | 'gemini' | 'groq' | 'openai' | 'anthropic' | 'mistral' | 'cohere' | 'ollama';

export type ImageProviderName =
  | 'gemini' | 'together' | 'openai-dall-e' | 'stability' | 'none';

export interface BotState {
  chatProvider: ChatProviderName;
  chatModel: string;
  imageProvider: ImageProviderName;
  imageModel: string;
  personaId: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  ext: string;
}

// Internal chat-history shapes
export interface GeminiTurn { role: 'user' | 'model'; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[]; }
export interface OpenAITurn { role: 'user' | 'assistant' | 'system'; content: string; }

// ─── Persistence ────────────────────────────────────────────────────────────

export interface AuthStoreShape {
  users: Record<string, AuthRole>; // userId -> role
}

export interface MemoryStoreShape {
  global: string[]; // persona-agnostic facts, known to every persona about everyone
  personas: {
    [personaId: string]: {
      [userId: string]: string[]; // facts only THIS persona knows about THIS user
    };
  };
}

export interface TriggerStoreShape {
  [keyword: string]: string[]; // keyword -> list of possible replies
}

export interface ChatLogEntry {
  ts: string;
  userId: string;
  username: string;
  role: 'user' | 'model';
  content: string;
}

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  hour: number;      // 0-23, in the reminder's timezone
  minute: number;     // 0-59
  repeat: 'once' | 'daily';
  timezone: string;   // IANA timezone
  channelId: string | null; // null = DM
  personaId: string;  // which persona delivers this reminder
  aiFlavor: boolean;  // if true, message is a prompt fed to the AI in-persona rather than sent verbatim
  lastFiredOn: string | null; // YYYY-MM-DD in the reminder's timezone
  createdAt: string;
}

export interface ReminderStoreShape {
  reminders: Reminder[];
  userTimezones: Record<string, string>;
}

export interface WelcomeConfigShape {
  enabled: boolean;
  channelId: string | null;
}
