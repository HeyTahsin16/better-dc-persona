import { readJSON, writeJSON } from './json';
import { WELCOME_PATH } from '../constants';
import { WelcomeConfigShape } from '../types';

const DEFAULT_CONFIG: WelcomeConfigShape = {
  enabled: false,
  channelId: null,
};

export function loadWelcomeConfig(): WelcomeConfigShape {
  return readJSON<WelcomeConfigShape>(WELCOME_PATH, DEFAULT_CONFIG);
}

export function saveWelcomeConfig(cfg: WelcomeConfigShape): void {
  writeJSON(WELCOME_PATH, cfg);
}

export function updateWelcomeConfig(partial: Partial<WelcomeConfigShape>): WelcomeConfigShape {
  const cfg = { ...loadWelcomeConfig(), ...partial };
  saveWelcomeConfig(cfg);
  return cfg;
}
