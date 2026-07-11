import { GoogleGenAI } from '@google/genai';
import type { AIProvider, GenerateImageArgs, GenerateImageResult, GenerateVideoArgs, GenerateVideoResult } from './provider';

// =============================================================================
// Director's Chair — Real Gemini AI Provider
// =============================================================================
// Connects to the Gemini API using the official @google/genai SDK.
// Leverages NB2 Lite (image gen) and Gemini Omni Flash (video gen/edit)
// via the new Interactions API.
// =============================================================================

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
      // ─── Turn 2+: Stateful Edit via previous_interaction_id ─────────────────
      if (args.previousInteractionId) {
        const fullPrompt = [args.prompt, ...args.instructions].join('\n');

        const response = await ai.interactions.create({
          model,
          previous_interaction_id: args.previousInteractionId,
          input: fullPrompt,
        } as any); // cast as any in case TS definitions are lagging behind preview SDK features

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

      // ─── Turn 1: Initial Generation or reference video/image input ──────────
      const inputParts: any[] = [];

      // Download and attach reference images as base64
      for (const imgUrl of args.referenceImages) {
        const base64Data = await downloadAsBase64(imgUrl);
        inputParts.push({
          type: 'image',
          data: base64Data,
          mime_type: 'image/png',
        });
      }

      // Download and attach reference videos as documents
      for (const videoUrl of args.referenceVideos) {
        // Soft references can also be uploaded to Gemini Files API or passed as base64 if small.
        // For simplicity in hackathon, we download and embed them as base64 videos or rely on text prompting.
        try {
          const base64Data = await downloadAsBase64(videoUrl);
          inputParts.push({
            type: 'video',
            data: base64Data,
            mime_type: 'video/mp4',
          });
        } catch (e) {
          console.warn('Skipped passing soft-reference video:', videoUrl, e);
        }
      }

      // Append text instruction
      const textPrompt = [args.prompt, ...args.instructions].join('\n');
      inputParts.push({
        type: 'text',
        text: textPrompt,
      });

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

/**
 * Downloads a URL and converts it to a base64 encoded string.
 */
async function downloadAsBase64(url: string): Promise<string> {
  // If url is relative (e.g. from local /demo), resolve it locally or fetch it
  let fetchUrl = url;
  if (url.startsWith('/')) {
    // Fallback logic for mock url resolution
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
