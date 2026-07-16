import { CohereClient } from 'cohere-ai';
import { env } from '../../env';
import { activeChatModel } from '../../store/stateStore';
import { getOpenAIHistory, pushOpenAITurn } from '../history';

let client: CohereClient | null = null;
function getClient(): CohereClient {
  if (!client) client = new CohereClient({ token: env.COHERE_API_KEY });
  return client;
}

export async function chat(channelId: string, userText: string, systemPrompt: string): Promise<string> {
  const history = getOpenAIHistory(channelId);
  const chatHistory = history.map(m => ({
    role: (m.role === 'assistant' ? 'CHATBOT' : 'USER') as 'CHATBOT' | 'USER',
    message: m.content,
  }));
  const res = await getClient().chat({ model: activeChatModel(), preamble: systemPrompt, chatHistory, message: userText });
  const reply = res.text;
  pushOpenAITurn(channelId, userText, reply);
  return reply;
}

export async function complete(prompt: string, systemPrompt: string): Promise<string> {
  const res = await getClient().chat({ model: activeChatModel(), preamble: systemPrompt, message: prompt });
  return res.text;
}
