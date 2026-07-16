import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../env';
import { activeChatModel } from '../../store/stateStore';
import { getOpenAIHistory, pushOpenAITurn } from '../history';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export async function chat(channelId: string, userText: string, systemPrompt: string): Promise<string> {
  const history = getOpenAIHistory(channelId); // role/content shape is compatible (never contains 'system' entries)
  const messages = [...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })), { role: 'user' as const, content: userText }];
  const res = await getClient().messages.create({
    model: activeChatModel(),
    system: systemPrompt,
    messages,
    max_tokens: 1024,
  });
  const reply = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
  pushOpenAITurn(channelId, userText, reply);
  return reply;
}

export async function chatWithImage(
  channelId: string, userText: string, systemPrompt: string, imageBuffer: Buffer, mimeType: string,
): Promise<string> {
  const history = getOpenAIHistory(channelId);
  const anthropicHistory = history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content }));
  const res = await getClient().messages.create({
    model: activeChatModel(),
    system: systemPrompt,
    max_tokens: 1024,
    messages: [
      ...anthropicHistory,
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: imageBuffer.toString('base64') } },
          { type: 'text', text: userText },
        ],
      },
    ],
  });
  const reply = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
  pushOpenAITurn(channelId, `${userText} [image attached]`, reply);
  return reply;
}

export async function complete(prompt: string, systemPrompt: string): Promise<string> {
  const res = await getClient().messages.create({
    model: activeChatModel(),
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  });
  return res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
}

// One-shot image Q&A, no conversation history — used by /analyze and as a vision fallback.
export async function visionAnswer(imageBuffer: Buffer, mimeType: string, question: string, systemPrompt?: string): Promise<string> {
  const res = await getClient().messages.create({
    model: activeChatModel(),
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: imageBuffer.toString('base64') } },
        { type: 'text', text: question },
      ],
    }],
  });
  return res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
}
