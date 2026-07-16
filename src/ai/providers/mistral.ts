import { Mistral } from '@mistralai/mistralai';
import { env } from '../../env';
import { activeChatModel } from '../../store/stateStore';
import { getOpenAIHistory, pushOpenAITurn } from '../history';

let client: Mistral | null = null;
function getClient(): Mistral {
  if (!client) client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
  return client;
}

export async function chat(channelId: string, userText: string, systemPrompt: string): Promise<string> {
  const history = getOpenAIHistory(channelId);
  const messages = [{ role: 'system' as const, content: systemPrompt }, ...history, { role: 'user' as const, content: userText }];
  const res = await getClient().chat.complete({ model: activeChatModel(), messages });
  const reply = String(res.choices?.[0]?.message?.content ?? '');
  pushOpenAITurn(channelId, userText, reply);
  return reply;
}

export async function complete(prompt: string, systemPrompt: string): Promise<string> {
  const res = await getClient().chat.complete({
    model: activeChatModel(),
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
  });
  return String(res.choices?.[0]?.message?.content ?? '');
}
