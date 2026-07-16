import fs from 'fs';
import path from 'path';
import { DATA_DIR, CHAT_LOG_DIR } from '../constants';
import { logger } from '../logger';

// Ensure runtime data directories exist before anything tries to read/write them.
for (const dir of [DATA_DIR, CHAT_LOG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readJSON<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(filePath: string, data: T): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error(`Failed to write ${filePath}`, err);
  }
}
