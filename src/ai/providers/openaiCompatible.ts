import OpenAI from 'openai';
import { env } from '../../env';
import { activeChatModel, activeImageModel } from '../../store/stateStore';
import { getOpenAIHistory, pushOpenAITurn } from '../history';
import { GeneratedImage } from '../../types';

export type Backend = 'groq' | 'openai' | 'ollama';

const clients: Partial<Record<Backend, OpenAI>> = {};

function getClient(backend: Backend): OpenAI {
  if (clients[backend]) return clients[backend]!;
  let instance: OpenAI;
  if (backend === 'groq') {
    // Groq exposes an OpenAI-compatible endpoint, so the official OpenAI SDK works directly.
    instance = new OpenAI({ apiKey: env.GROQ_API_KEY || 'missing', baseURL: 'https://api.groq.com/openai/v1' });
  } else if (backend === 'ollama') {
    instance = new OpenAI({ apiKey: 'ollama', baseURL: `${env.OLLAMA_BASE_URL}/v1` });
  } else {
    instance = new OpenAI({ apiKey: env.OPENAI_API_KEY || 'missing' });
  }
  clients[backend] = instance;
  return instance;
}

export async function chat(backend: Backend, channelId: string, userText: string, systemPrompt: string): Promise<string> {
  const history = getOpenAIHistory(channelId);
  const messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userText }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getClient(backend).chat.completions.create({ model: activeChatModel(), messages: messages as any });
  const reply = res.choices[0]?.message?.content ?? '';
  pushOpenAITurn(channelId, userText, reply);
  return reply;
}

export async function chatWithImage(
  backend: Backend, channelId: string, userText: string, systemPrompt: string, imageBuffer: Buffer, mimeType: string,
): Promise<string> {
  const history = getOpenAIHistory(channelId);
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getClient(backend).chat.completions.create({ model: activeChatModel(), messages: messages as any });
  const reply = res.choices[0]?.message?.content ?? '';
  pushOpenAITurn(channelId, `${userText} [image attached]`, reply);
  return reply;
}

export async function complete(backend: Backend, prompt: string, systemPrompt: string): Promise<string> {
  const res = await getClient(backend).chat.completions.create({
    model: activeChatModel(),
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content ?? '';
}

// One-shot image Q&A, no conversation history — used by /analyze and as a vision fallback.
export async function visionAnswer(backend: Backend, imageBuffer: Buffer, mimeType: string, question: string, systemPrompt?: string): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: [
      { type: 'text', text: question },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getClient(backend).chat.completions.create({ model: activeChatModel(), messages: messages as any });
  return res.choices[0]?.message?.content ?? '';
}

export async function generateImageDallE(prompt: string): Promise<GeneratedImage> {
  const res = await getClient('openai').images.generate({
    model: activeImageModel(), prompt, n: 1, size: '1024x1024', response_format: 'b64_json',
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned from DALL-E.');
  return { buffer: Buffer.from(b64, 'base64'), ext: 'png' };
}
