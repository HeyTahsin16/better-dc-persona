import { readLog } from '../store/chatLogStore';
import { completeOneShot } from '../ai/chatRouter';

const LOG_QA_SYSTEM_PROMPT =
  'You answer questions about a Discord chat log. Answer only from what appears in the log. ' +
  'Be concise and accurate. If the answer is not there, say so honestly.';

export async function queryChatLog(channelId: string, question: string): Promise<string> {
  const entries = readLog(channelId, 200);
  if (!entries.length) return 'No chat history found for this channel.';
  const logText = entries.map(e => `[${e.ts.slice(0, 16)}] ${e.username}: ${e.content}`).join('\n');
  const prompt = `Chat log:\n\n${logText}\n\nQuestion: ${question}`;
  return completeOneShot(prompt, LOG_QA_SYSTEM_PROMPT);
}
