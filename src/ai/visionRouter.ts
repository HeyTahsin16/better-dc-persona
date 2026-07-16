import { env } from '../env';
import { state } from '../store/stateStore';
import { NATIVE_VISION_PROVIDERS } from '../constants';
import { buildSystemPrompt } from './promptBuilder';

import * as gemini from './providers/gemini';
import * as openaiCompat from './providers/openaiCompatible';
import * as anthropic from './providers/anthropic';

const NEUTRAL_SYSTEM_PROMPT = 'You are a precise, objective visual assistant. Describe images factually and completely.';

// Used internally when a non-vision-native chat provider needs image context —
// always tries to use a real vision-capable key regardless of the active chat provider,
// and stays neutral/objective so it can be cleanly relayed into an in-character reply afterward.
export async function describeImageForChat(buffer: Buffer, mimeType: string, question: string): Promise<string> {
  if (env.GEMINI_API_KEY) return gemini.visionAnswer(buffer, mimeType, question, NEUTRAL_SYSTEM_PROMPT);
  if (env.OPENAI_API_KEY) return openaiCompat.visionAnswer('openai', buffer, mimeType, question, NEUTRAL_SYSTEM_PROMPT);
  if (env.ANTHROPIC_API_KEY) return anthropic.visionAnswer(buffer, mimeType, question, NEUTRAL_SYSTEM_PROMPT);
  throw new Error('No vision-capable provider is configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.');
}

// User-facing image analysis (e.g. /analyze) — answers in the active persona's voice
// when the active chat provider supports vision, otherwise falls back to a neutral description.
export async function analyzeImage(buffer: Buffer, mimeType: string, question: string, userId: string, username: string): Promise<string> {
  const systemPrompt = buildSystemPrompt(userId, username);

  if (NATIVE_VISION_PROVIDERS.has(state.chatProvider)) {
    switch (state.chatProvider) {
      case 'openai': return openaiCompat.visionAnswer('openai', buffer, mimeType, question, systemPrompt);
      case 'anthropic': return anthropic.visionAnswer(buffer, mimeType, question, systemPrompt);
      case 'gemini':
      default: return gemini.visionAnswer(buffer, mimeType, question, systemPrompt);
    }
  }

  return describeImageForChat(buffer, mimeType, question);
}
