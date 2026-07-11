import { GoogleGenAI } from '@google/genai';
import type { AIProvider, GenerateImageArgs, GenerateImageResult, GenerateVideoArgs, GenerateVideoResult } from './provider';

export class RealProvider implements AIProvider {
  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env.local');
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateImage(args: GenerateImageArgs): Promise<GenerateImageResult> {
    const ai = this.getClient();
    const model = process.env.NB2_MODEL_ID || 'nb2-lite-preview';

    try {
      const response = await ai.interactions.create({
        model,
        input: args.prompt,
      });

      const outputImage = response.output_image;
      if (!outputImage || !outputImage.data) {
        throw new Error('No image data returned from Gemini image generation.');
      }

      return {
        bytes: Buffer.from(outputImage.data, 'base64'),
        contentType: 'image/png',
      };
    } catch (error: any) {
      console.error('Gemini Image Generation Error:', error);
      throw new Error(error.message || 'Failed to generate image via Gemini API');
    }
  }

  async generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult> {
    const ai = this.getClient();
    const model = process.env.OMNI_MODEL_ID || 'gemini-omni-flash-preview';

    try {
      if (args.previousInteractionId) {
        const fullPrompt = [args.prompt, ...args.instructions].join('\n');

        const response = await ai.interactions.create({
          model,
          previous_interaction_id: args.previousInteractionId,
          input: fullPrompt,
        } as any);

        const outputVideo = response.output_video;
        if (!outputVideo || !outputVideo.data) {
          throw new Error('No video data returned from stateful Gemini video edit.');
        }

        return {
          bytes: Buffer.from(outputVideo.data, 'base64'),
          contentType: 'video/mp4',
          interactionId: response.id,
        };
      }

      const inputParts: any[] = [];

      if (args.baseVideo) {
        const base64Data = await downloadAsBase64(args.baseVideo);
        inputParts.push({
          type: 'video',
          data: base64Data,
          mime_type: 'video/mp4',
        });
      }

      for (const imgUrl of args.referenceImages) {
        const base64Data = await downloadAsBase64(imgUrl);
        inputParts.push({
          type: 'image',
          data: base64Data,
          mime_type: guessImageMime(imgUrl),
        });
      }

      for (const videoUrl of args.referenceVideos) {
        if (videoUrl === args.baseVideo) continue;
        try {
          const base64Data = await downloadAsBase64(videoUrl);
          inputParts.push({
            type: 'video',
            data: base64Data,
            mime_type: 'video/mp4',
          });
        } catch (e) {
          console.warn('Skipped passing reference video:', videoUrl, e);
        }
      }

      for (const audioUrl of args.referenceAudios || []) {
        try {
          const base64Data = await downloadAsBase64(audioUrl);
          inputParts.push({
            type: 'audio',
            data: base64Data,
            mime_type: guessAudioMime(audioUrl),
          });
        } catch (e) {
          console.warn('Skipped passing reference audio:', audioUrl, e);
        }
      }

      const textPrompt = [args.prompt, ...args.instructions].join('\n');
      inputParts.push({ type: 'text', text: textPrompt });

      const response = await ai.interactions.create({
        model,
        input: inputParts,
      });

      const outputVideo = response.output_video;
      if (!outputVideo || !outputVideo.data) {
        throw new Error('No video data returned from Gemini video generation.');
      }

      return {
        bytes: Buffer.from(outputVideo.data, 'base64'),
        contentType: 'video/mp4',
        interactionId: response.id,
      };
    } catch (error: any) {
      console.error('Gemini Video Generation Error:', error);
      throw new Error(error.message || 'Failed to generate video via Gemini API');
    }
  }
}

function guessImageMime(url: string): string {
  if (url.match(/\.jpe?g($|\?)/i)) return 'image/jpeg';
  if (url.match(/\.webp($|\?)/i)) return 'image/webp';
  if (url.match(/\.gif($|\?)/i)) return 'image/gif';
  return 'image/png';
}

function guessAudioMime(url: string): string {
  if (url.match(/\.wav($|\?)/i)) return 'audio/wav';
  if (url.match(/\.ogg($|\?)/i)) return 'audio/ogg';
  return 'audio/mpeg';
}

async function downloadAsBase64(url: string): Promise<string> {
  let fetchUrl = url;
  if (url.startsWith('/')) {
    const port = process.env.PORT || 3000;
    fetchUrl = `http://localhost:${port}${url}`;
  }

  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Failed to download resource from ${url}: ${res.statusText}`);
  }

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
