import { env } from '../../env';
import { activeImageModel } from '../../store/stateStore';
import { GeneratedImage } from '../../types';

interface StabilityResponse {
  artifacts?: { base64?: string }[];
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const form = new URLSearchParams();
  form.append('text_prompts[0][text]', prompt);
  form.append('cfg_scale', '7');
  form.append('height', '1024');
  form.append('width', '1024');
  form.append('samples', '1');

  const res = await fetch(`https://api.stability.ai/v1/generation/${activeImageModel()}/text-to-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STABILITY_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Stability API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as StabilityResponse;
  const b64 = data.artifacts?.[0]?.base64;
  if (!b64) throw new Error('No image data returned from Stability AI.');
  return { buffer: Buffer.from(b64, 'base64'), ext: 'png' };
}
