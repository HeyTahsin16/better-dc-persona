import fs from 'fs';
import path from 'path';
import { env } from './env';
import { SYSTEM_LOG_DIR } from './constants';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentWeight = LEVEL_WEIGHT[(env.LOG_LEVEL as Level) in LEVEL_WEIGHT ? (env.LOG_LEVEL as Level) : 'info'];

function safeStringify(meta: unknown): string {
  if (meta === undefined) return '';
  try {
    if (meta instanceof Error) return ` :: ${meta.message}${meta.stack ? `\n${meta.stack}` : ''}`;
    return ` :: ${JSON.stringify(meta)}`;
  } catch {
    return ' :: [unserializable meta]';
  }
}

function writeToFile(line: string): void {
  if (!env.LOG_TO_FILE) return;
  try {
    fs.mkdirSync(SYSTEM_LOG_DIR, { recursive: true });
    const file = path.join(SYSTEM_LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, line + '\n', 'utf-8');
  } catch {
    // best-effort — never let logging crash the bot
  }
}

function emit(level: Level, msg: string, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < currentWeight) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${safeStringify(meta)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  writeToFile(line);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
