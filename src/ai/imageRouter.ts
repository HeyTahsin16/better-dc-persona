import { state } from '../store/stateStore';
import { GeneratedImage } from '../types';

import * as gemini from './providers/gemini';
import * as openaiCompat from './providers/openaiCompatible';
import * as together from './providers/together';
import * as stability from './providers/stability';

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  switch (state.imageProvider) {
    case 'none':
      throw new Error('Image generation is disabled. An admin can enable it with /imgprovider set.');
    case 'gemini':
      return gemini.generateImage(prompt);
    case 'together':
      return together.generateImage(prompt);
    case 'openai-dall-e':
      return openaiCompat.generateImageDallE(prompt);
    case 'stability':
      return stability.generateImage(prompt);
    default:
      throw new Error(`Unknown image provider: ${state.imageProvider}`);
  }
}
