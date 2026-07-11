import type { AIProvider, GenerateImageResult, GenerateVideoResult, GenerateVideoArgs } from './provider';

// =============================================================================
// Director's Chair — Mock AI Provider
// =============================================================================
// Simulates network latency and cycles through pre-generated demo assets
// inside /public/demo to keep the application runnable offline.
// =============================================================================

export class MockProvider implements AIProvider {
  private delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  async generateImage(args: { prompt: string }): Promise<GenerateImageResult> {
    console.log(`[MockProvider] generateImage called with prompt: "${args.prompt}"`);
    await this.delay(800);
    const images = ['hero.png', 'spaceship.png', 'bridge.png'];
    const chosen = pick(images);
    console.log(`[MockProvider] Cycling to mock asset: /demo/images/${chosen}`);
    return {
      url: `/demo/images/${chosen}`,
      contentType: 'image/png',
    };
  }

  async generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult> {
    console.log(`[MockProvider] generateVideo called with prompt: "${args.prompt}"`);
    console.log('[MockProvider] Full instructions:', args.instructions);
    await this.delay(1500);

    // If it's an edit action, return the designated edit placeholder
    if (args.baseVideo || args.previousInteractionId) {
      console.log('[MockProvider] Detected edit request, returning edit.mp4');
      return {
        url: '/demo/videos/edit.mp4',
        contentType: 'video/mp4',
        interactionId: 'mock_interaction_edit_' + Math.random().toString(36).substring(7),
      };
    }

    const videos = ['shot1.mp4', 'shot2.mp4', 'shot3.mp4'];
    const chosen = pick(videos);
    console.log(`[MockProvider] Cycling to mock video: /demo/videos/${chosen}`);
    return {
      url: `/demo/videos/${chosen}`,
      contentType: 'video/mp4',
      interactionId: 'mock_interaction_new_' + Math.random().toString(36).substring(7),
    };
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
