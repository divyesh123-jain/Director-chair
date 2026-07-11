import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { z } from 'zod';

const generateAssetSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1),
  tag: z.string().regex(/^[A-Za-z0-9_]+$/),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = generateAssetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { projectId, prompt, tag } = parsed.data;
    const { getServerSupabaseClient } = await import('@/lib/supabase');
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: projectCheck } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!projectCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Verify tag is unique within the project (case-insensitive)
    const { data: existingAssets, error: tagCheckError } = await supabase
      .from('assets')
      .select('tag')
      .eq('project_id', projectId);

    if (tagCheckError) {
      throw tagCheckError;
    }

    const tagExists = existingAssets?.some(
      (a: any) => a.tag.toLowerCase() === tag.toLowerCase()
    );

    if (tagExists) {
      return NextResponse.json(
        { error: `Tag @${tag} is already in use for this project.` },
        { status: 409 }
      );
    }

    // 2. Generate the image using the active provider (defaults to NB2 Lite mock/real)
    const provider = getProvider();
    const result = await provider.generateImage({ prompt });

    let finalUrl = '';

    if (result.url && !result.bytes) {
      // Mock provider returns local public URLs like "/demo/images/hero.png"
      // We read the local file and upload it to Supabase Storage so it gets a real Supabase URL!
      try {
        const fs = require('fs');
        const path = require('path');
        const localPath = path.join(process.cwd(), 'public', result.url);

        if (fs.existsSync(localPath)) {
          const fileBytes = fs.readFileSync(localPath);
          const fileId = crypto.randomUUID();
          const filePath = `assets/${projectId}/${fileId}.png`;

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, fileBytes, {
              contentType: 'image/png',
              duplex: 'half',
            } as any);

          if (uploadError) {
            console.error('Supabase Storage mock upload error:', uploadError);
            finalUrl = result.url; // Fallback to local url
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('assets')
              .getPublicUrl(filePath);
            finalUrl = publicUrl;
          }
        } else {
          finalUrl = result.url;
        }
      } catch (err) {
        console.error('Failed to read mock file for upload:', err);
        finalUrl = result.url;
      }
    } else if (result.bytes) {
      // Real provider returns raw bytes; we upload to Supabase Storage
      const fileId = crypto.randomUUID();
      const filePath = `assets/${projectId}/${fileId}.png`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, result.bytes, {
          contentType: result.contentType || 'image/png',
          duplex: 'half',
        } as any);

      if (uploadError) {
        console.error('Supabase Storage upload error:', uploadError);
        throw new Error(`Failed to upload generated asset: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      finalUrl = publicUrl;
    } else {
      throw new Error('AI provider returned empty response.');
    }

    // 3. Register the asset in the database
    const { data: newAsset, error: insertError } = await supabase
      .from('assets')
      .insert({
        project_id: projectId,
        type: 'image',
        tag,
        url: finalUrl,
        prompt,
        source: 'nb2',
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ data: newAsset });
  } catch (error: any) {
    console.error('POST /api/assets/generate error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
