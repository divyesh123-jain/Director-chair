import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const enhanceSchema = z.object({
  prompt: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = enhanceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { prompt } = parsed.data;

    let enhanced = '';

    if (process.env.AI_PROVIDER === 'real') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in .env.local');
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction =
        "You are a cinematic prompt engineer. Enhance the provided user prompt to make it highly detailed, " +
        "descriptive, visually stunning, and optimized for high-quality image or video generation. " +
        "CRITICAL: If the prompt contains tag handles starting with '@' (e.g., @hero, @spaceship, @bridge), " +
        "you MUST preserve those exact tags in the output. Do not translate, rename, or omit them. " +
        "Return ONLY the final enhanced prompt string. Do not include markdown codeblocks, double quotes, " +
        "or any conversational responses.";

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      enhanced = response.text?.trim() || prompt;
      // Strip out any surrounding quotes if returned
      enhanced = enhanced.replace(/^["']|["']$/g, '');
    } else {
      // Mock Enhancer fallback: append professional cinematics
      const modifiers = [
        'cinematic lighting',
        'photorealistic',
        'highly detailed 8k',
        'futuristic sci-fi design',
        'dramatic atmosphere',
        'composition with depth of field'
      ];
      enhanced = `${prompt}, ${modifiers.join(', ')}`;
    }

    return NextResponse.json({ data: { enhanced } });
  } catch (error: any) {
    console.error('POST /api/prompt/enhance error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
