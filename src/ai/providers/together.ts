import { env } from '../../env';
import { activeImageModel } from '../../store/stateStore';
import { GeneratedImage } from '../../types';

interface TogetherResponse {
  data?: { url?: string }[];
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: activeImageModel(), prompt, n: 1, width: 1024, height: 1024 }),
  });
  if (!res.ok) throw new Error(`Together API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as TogetherResponse;
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('No image URL returned from Together AI.');
  const imgRes = await fetch(url);
  return { buffer: Buffer.from(await imgRes.arrayBuffer()), ext: 'png' };
}
