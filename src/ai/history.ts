import { GeminiTurn, OpenAITurn } from '../types';
import { env } from '../env';

const geminiHistory = new Map<string, GeminiTurn[]>();
const openaiHistory = new Map<string, OpenAITurn[]>(); // shared shape for groq/openai/anthropic/mistral/cohere/ollama

const MAX_PAIRS = env.MAX_HISTORY;

// `key` is normally a composite "channelId:personaId" string (see chatRouter),
// keeping each persona's conversation in a channel isolated from the others.
export function getGeminiHistory(key: string): GeminiTurn[] {
  if (!geminiHistory.has(key)) geminiHistory.set(key, []);
  return geminiHistory.get(key)!;
}

export function pushGeminiTurn(key: string, userText: string, modelText: string): void {
  const h = getGeminiHistory(key);
  h.push({ role: 'user', parts: [{ text: userText }] });
  h.push({ role: 'model', parts: [{ text: modelText }] });
  if (h.length > MAX_PAIRS * 2) h.splice(0, 2);
}

export function getOpenAIHistory(key: string): OpenAITurn[] {
  if (!openaiHistory.has(key)) openaiHistory.set(key, []);
  return openaiHistory.get(key)!;
}

export function pushOpenAITurn(key: string, userText: string, assistantText: string): void {
  const h = getOpenAIHistory(key);
  h.push({ role: 'user', content: userText });
  h.push({ role: 'assistant', content: assistantText });
  if (h.length > MAX_PAIRS * 2) h.splice(0, 2);
}

// Clears every persona's thread for a given channel (keys are "channelId:personaId").
export function clearHistory(channelId: string): void {
  const prefix = `${channelId}:`;
  for (const key of geminiHistory.keys()) if (key.startsWith(prefix)) geminiHistory.delete(key);
  for (const key of openaiHistory.keys()) if (key.startsWith(prefix)) openaiHistory.delete(key);
}

export function clearAllHistory(): void {
  geminiHistory.clear();
  openaiHistory.clear();
}
