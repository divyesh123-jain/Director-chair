// =============================================================================
// Director's Chair — AI Provider Abstraction Interface
// =============================================================================

export interface GenerateImageArgs {
  prompt: string;
}

export interface GenerateImageResult {
  url?: string;
  bytes?: Buffer;
  contentType?: string; // e.g. 'image/png'
}

export interface GenerateVideoArgs {
  prompt: string;
  instructions: string[];           // physics/consistency/edit prompts
  referenceImages: string[];        // asset URLs (@tags)
  referenceVideos: string[];        // prior-shot video URLs
  baseVideo: string | null;         // parent shot video URL (if edit)
  previousInteractionId?: string | null; // Gemini interaction ID for stateful editing
}

export interface GenerateVideoResult {
  url?: string;
  bytes?: Buffer;
  contentType?: string;             // e.g. 'video/mp4'
  interactionId?: string;           // Returned by the Interactions API
}

export interface AIProvider {
  generateImage(args: GenerateImageArgs): Promise<GenerateImageResult>;
  generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult>;
}

/**
 * Factory to retrieve the active AI provider singleton.
 * Switches dynamically based on the AI_PROVIDER environment variable.
 */
export function getProvider(): AIProvider {
  if (process.env.AI_PROVIDER === 'real') {
    const { RealProvider } = require('./real');
    return new RealProvider();
  }
  const { MockProvider } = require('./mock');
  return new MockProvider();
}
