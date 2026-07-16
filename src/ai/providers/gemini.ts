import { GoogleGenAI } from '@google/genai';
import { env } from '../../env';
import { activeChatModel, activeImageModel } from '../../store/stateStore';
import { getGeminiHistory, pushGeminiTurn } from '../history';
import { GeneratedImage } from '../../types';

// NOTE: uses @google/genai (the current, actively-maintained unified SDK).
// The older @google/generative-ai package is legacy and no longer used here.
// Image generation uses Gemini's native "Nano Banana" image models via generateContent
// rather than the standalone Imagen API, which Google is retiring in 2026.

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export async function chat(channelId: string, userText: string, systemPrompt: string): Promise<string> {
  const history = getGeminiHistory(channelId);
  const chatSession = getClient().chats.create({
    model: activeChatModel(),
    config: { systemInstruction: systemPrompt },
    history,
  });
  const response = await chatSession.sendMessage({ message: userText });
  const reply = response.text ?? '';
  pushGeminiTurn(channelId, userText, reply);
  return reply;
}

export async function chatWithImage(
  channelId: string, userText: string, systemPrompt: string, imageBuffer: Buffer, mimeType: string,
): Promise<string> {
  const history = getGeminiHistory(channelId);
  const chatSession = getClient().chats.create({
    model: activeChatModel(),
    config: { systemInstruction: systemPrompt },
    history,
  });
  const response = await chatSession.sendMessage({
    message: [{ inlineData: { mimeType, data: imageBuffer.toString('base64') } }, userText],
  });
  const reply = response.text ?? '';
  pushGeminiTurn(channelId, `${userText} [image attached]`, reply);
  return reply;
}

// One-shot image Q&A, no conversation history — used by /analyze and as a vision fallback.
export async function visionAnswer(imageBuffer: Buffer, mimeType: string, question: string, systemPrompt?: string): Promise<string> {
  const response = await getClient().models.generateContent({
    model: activeChatModel(),
    contents: [{ inlineData: { mimeType, data: imageBuffer.toString('base64') } }, question],
    ...(systemPrompt ? { config: { systemInstruction: systemPrompt } } : {}),
  });
  return response.text ?? '';
}

// One-shot text completion — used for log Q&A and welcome-message generation.
export async function complete(prompt: string, systemPrompt: string): Promise<string> {
  const response = await getClient().models.generateContent({
    model: activeChatModel(),
    contents: prompt,
    config: { systemInstruction: systemPrompt },
  });
  return response.text ?? '';
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const response = await getClient().models.generateContent({
    model: activeImageModel(),
    contents: prompt,
  });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error('No image returned from Gemini.');
  return { buffer: Buffer.from(imagePart.inlineData.data, 'base64'), ext: 'png' };
}
