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
      // Stateful text edit via previous_interaction_id (edits only).
      if (args.isEdit && args.previousInteractionId) {
        try {
          return await this.statefulEdit(ai, model, args);
        } catch (error: any) {
          if (!isVideoInputUnsupported(error)) throw error;
          console.warn(
            'Stateful edit failed, falling back to text-only multimodal:',
            error.message
          );
        }
      }

      return await this.multimodalGenerate(ai, model, args);
    } catch (error: any) {
      console.error('Gemini Video Generation Error:', error);
      throw new Error(error.message || 'Failed to generate video via Gemini API');
    }
  }

  private async statefulEdit(
    ai: GoogleGenAI,
    model: string,
    args: GenerateVideoArgs
  ): Promise<GenerateVideoResult> {
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

  /** Images + text only — Gemini Omni does not support video inputs. */
  private async multimodalGenerate(
    ai: GoogleGenAI,
    model: string,
    args: GenerateVideoArgs
  ): Promise<GenerateVideoResult> {
    const inputParts: any[] = [];

    for (const imgUrl of args.referenceImages) {
      const base64Data = await downloadAsBase64(imgUrl);
      inputParts.push({
        type: 'image',
        data: base64Data,
        mime_type: guessImageMime(imgUrl),
      });
    }

    const textPrompt = [args.prompt, ...args.instructions].join('\n');
    inputParts.push({ type: 'text', text: textPrompt });

    const response = await ai.interactions.create({
      model,
      input: inputParts.length === 1 ? textPrompt : inputParts,
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
  }
}

function isVideoInputUnsupported(error: any): boolean {
  const msg = (error?.message || error?.body || '').toString().toLowerCase();
  return msg.includes('video') && msg.includes('not supported');
}

function guessImageMime(url: string): string {
  if (url.match(/\.jpe?g($|\?)/i)) return 'image/jpeg';
  if (url.match(/\.webp($|\?)/i)) return 'image/webp';
  if (url.match(/\.gif($|\?)/i)) return 'image/gif';
  return 'image/png';
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
