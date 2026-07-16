import fs from 'fs';
import path from 'path';
import { AVATARS_DIR } from '../constants';
import { env } from '../env';
import { logger } from '../logger';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

// avatarKey -> filename (with extension), rebuilt on startup and on /reload.
let fileMap: Map<string, string> = new Map();

function scanAvatars(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (!fs.existsSync(AVATARS_DIR)) return map;
    for (const file of fs.readdirSync(AVATARS_DIR)) {
      const ext = path.extname(file).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
      map.set(path.basename(file, ext).toLowerCase(), file);
    }
  } catch (err) {
    logger.warn('Failed to scan avatars directory', err);
  }
  return map;
}

export function refreshAvatarCache(): void {
  fileMap = scanAvatars();
  logger.info(fileMap.size ? `Avatars found: ${[...fileMap.keys()].join(', ')}` : 'No avatar files found in /avatars.');
}

export function getPublicBaseUrl(): string | null {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

// Returns a fully-qualified public URL for a persona's avatar, or undefined if
// no matching file exists or no public URL is configured (webhook send still
// works without this — the persona just gets Discord's default icon).
export function getAvatarUrl(avatarKey: string): string | undefined {
  const filename = fileMap.get(avatarKey.toLowerCase());
  if (!filename) return undefined;
  const base = getPublicBaseUrl();
  if (!base) return undefined;
  return `${base}/avatars/${encodeURIComponent(filename)}`;
}

export function resolveAvatarFilePath(filename: string): string | null {
  // Guards against path traversal since this backs a public HTTP route.
  const safe = path.basename(filename);
  const full = path.join(AVATARS_DIR, safe);
  return fs.existsSync(full) ? full : null;
}
