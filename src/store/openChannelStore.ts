import { readJSON, writeJSON } from './json';
import path from 'path';
import { DATA_DIR } from '../constants';

const OPEN_CHANNEL_PATH = path.join(DATA_DIR, 'open_channel.json');

interface OpenChannelShape {
  channelId: string | null;
}

function load(): OpenChannelShape {
  return readJSON<OpenChannelShape>(OPEN_CHANNEL_PATH, { channelId: null });
}

export function getOpenChannelId(): string | null {
  return load().channelId;
}

export function setOpenChannelId(channelId: string): void {
  writeJSON(OPEN_CHANNEL_PATH, { channelId });
}

export function clearOpenChannelId(): void {
  writeJSON(OPEN_CHANNEL_PATH, { channelId: null });
}
