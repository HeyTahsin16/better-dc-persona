import { state } from '../store/stateStore';
import { buildSystemPrompt, buildRawSystemPrompt, getActivePersona } from './promptBuilder';
import { appendLog } from '../store/chatLogStore';
import { withRetry } from './retry';
import { NATIVE_VISION_PROVIDERS } from '../constants';
import { describeImageForChat } from './visionRouter';
import { Persona } from '../types';

import * as gemini from './providers/gemini';
import * as openaiCompat from './providers/openaiCompatible';
import * as anthropic from './providers/anthropic';
import * as mistral from './providers/mistral';
import * as cohere from './providers/cohere';

// Conversation history is keyed by "channelId:personaId" rather than just channelId,
// so replying to a specific character's webhook message continues THAT character's
// thread even if a different persona is now the server-wide active one.
function threadKey(channelId: string, personaId: string): string {
  return `${channelId}:${personaId}`;
}

async function dispatchChat(threadKeyStr: string, userText: string, systemPrompt: string): Promise<string> {
  switch (state.chatProvider) {
    case 'groq': return openaiCompat.chat('groq', threadKeyStr, userText, systemPrompt);
    case 'openai': return openaiCompat.chat('openai', threadKeyStr, userText, systemPrompt);
    case 'ollama': return openaiCompat.chat('ollama', threadKeyStr, userText, systemPrompt);
    case 'anthropic': return anthropic.chat(threadKeyStr, userText, systemPrompt);
    case 'mistral': return mistral.chat(threadKeyStr, userText, systemPrompt);
    case 'cohere': return cohere.chat(threadKeyStr, userText, systemPrompt);
    case 'gemini':
    default: return gemini.chat(threadKeyStr, userText, systemPrompt);
  }
}

export async function getAIResponse(
  channelId: string, userText: string, userId: string, username: string, persona: Persona = getActivePersona(),
): Promise<string> {
  const systemPrompt = buildSystemPrompt(userId, username, persona);
  const key = threadKey(channelId, persona.id);
  const reply = await withRetry(() => dispatchChat(key, `[${username}]: ${userText}`, systemPrompt));

  const ts = new Date().toISOString();
  appendLog(channelId, { ts, userId, username, role: 'user', content: userText });
  appendLog(channelId, { ts, userId: 'bot', username: persona.name, role: 'model', content: reply });

  return reply;
}

export async function getAIResponseWithImage(
  channelId: string, userText: string, userId: string, username: string,
  imageBuffer: Buffer, mimeType: string, persona: Persona = getActivePersona(),
): Promise<string> {
  const systemPrompt = buildSystemPrompt(userId, username, persona);
  const key = threadKey(channelId, persona.id);
  const taggedText = `[${username}]: ${userText}`;

  const reply = await withRetry(async () => {
    if (NATIVE_VISION_PROVIDERS.has(state.chatProvider)) {
      switch (state.chatProvider) {
        case 'openai': return openaiCompat.chatWithImage('openai', key, taggedText, systemPrompt, imageBuffer, mimeType);
        case 'anthropic': return anthropic.chatWithImage(key, taggedText, systemPrompt, imageBuffer, mimeType);
        case 'gemini':
        default: return gemini.chatWithImage(key, taggedText, systemPrompt, imageBuffer, mimeType);
      }
    }
    // Non-vision-native provider: describe the image first, then relay as a normal text turn.
    const description = await describeImageForChat(imageBuffer, mimeType, 'Describe this image in detail, objectively.');
    const combined = `${taggedText}\n\n[Attached image — description: ${description}]`;
    return dispatchChat(key, combined, systemPrompt);
  });

  const ts = new Date().toISOString();
  appendLog(channelId, { ts, userId, username, role: 'user', content: `${userText} [image attached]` });
  appendLog(channelId, { ts, userId: 'bot', username: persona.name, role: 'model', content: reply });

  return reply;
}

// "noper"-prefixed messages: pure, unfiltered AI with no persona, no memories, no
// character flavor — one-shot, no persistent conversation history by design (it's
// meant as a quick factual escape hatch, not a sustained conversation).
export async function getRawAIResponse(userText: string): Promise<string> {
  return completeOneShot(userText, buildRawSystemPrompt());
}

// One-shot completion used for log Q&A and welcome messages — no persistent history,
// always uses the server-wide active provider/persona since it isn't part of a conversation thread.
export async function completeOneShot(prompt: string, systemPrompt: string): Promise<string> {
  return withRetry(async () => {
    switch (state.chatProvider) {
      case 'groq': return openaiCompat.complete('groq', prompt, systemPrompt);
      case 'openai': return openaiCompat.complete('openai', prompt, systemPrompt);
      case 'ollama': return openaiCompat.complete('ollama', prompt, systemPrompt);
      case 'anthropic': return anthropic.complete(prompt, systemPrompt);
      case 'mistral': return mistral.complete(prompt, systemPrompt);
      case 'cohere': return cohere.complete(prompt, systemPrompt);
      case 'gemini':
      default: return gemini.complete(prompt, systemPrompt);
    }
  });
}
