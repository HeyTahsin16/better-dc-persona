import { readJSON, writeJSON } from './json';
import { STATE_PATH, PROVIDER_DEFAULTS, IMAGE_PROVIDER_DEFAULTS } from '../constants';
import { BotState, ChatProviderName, ImageProviderName } from '../types';
import { env } from '../env';

const initial: BotState = readJSON<BotState>(STATE_PATH, {
  chatProvider: (env.AI_PROVIDER as ChatProviderName) || 'gemini',
  chatModel: env.AI_MODEL || '',
  imageProvider: (env.IMAGE_PROVIDER as ImageProviderName) || 'gemini',
  imageModel: env.IMAGE_MODEL || '',
  personaId: env.DEFAULT_PERSONA || 'asuna',
});

// Single in-memory instance, mutated by setters below and persisted on every change.
export const state: BotState = { ...initial };

export function saveState(): void {
  writeJSON(STATE_PATH, state);
}

export function activeChatModel(): string {
  return state.chatModel || PROVIDER_DEFAULTS[state.chatProvider] || 'unknown';
}

export function activeImageModel(): string {
  if (state.imageProvider === 'none') return 'disabled';
  return state.imageModel || IMAGE_PROVIDER_DEFAULTS[state.imageProvider] || 'unknown';
}

export function setChatProvider(provider: ChatProviderName, model = ''): void {
  state.chatProvider = provider;
  state.chatModel = model;
  saveState();
}

export function setChatModel(model: string): void {
  state.chatModel = model;
  saveState();
}

export function setImageProvider(provider: ImageProviderName, model = ''): void {
  state.imageProvider = provider;
  state.imageModel = model;
  saveState();
}

export function setPersonaId(personaId: string): void {
  state.personaId = personaId;
  saveState();
}
