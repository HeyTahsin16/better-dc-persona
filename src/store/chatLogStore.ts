import fs from 'fs';
import path from 'path';
import { CHAT_LOG_DIR } from '../constants';
import { ChatLogEntry } from '../types';

function logFilePath(channelId: string): string {
  return path.join(CHAT_LOG_DIR, `${channelId}.jsonl`);
}

export function appendLog(channelId: string, entry: ChatLogEntry): void {
  fs.appendFileSync(logFilePath(channelId), JSON.stringify(entry) + '\n', 'utf-8');
}

export function readLog(channelId: string, limit = 100): ChatLogEntry[] {
  const file = logFilePath(channelId);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .slice(-limit)
    .map(l => JSON.parse(l) as ChatLogEntry);
}

export function searchLog(channelId: string, query: string): ChatLogEntry[] {
  const file = logFilePath(channelId);
  if (!fs.existsSync(file)) return [];
  const q = query.toLowerCase();
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as ChatLogEntry)
    .filter(e => e.content?.toLowerCase().includes(q));
}
