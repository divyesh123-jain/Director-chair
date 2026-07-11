import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { resolveTags } from '@/lib/tags';
import { buildVideoContext } from '@/lib/prompt';
import { z } from 'zod';

const editShotSchema = z.object({
  projectId: z.string().uuid(),
  parentShotId: z.string().uuid(),
  message: z.string().min(1),
});

export async function POST(request: Request) {
  let createdShotId: string | null = null;
  let supabase: any = null;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = editShotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { projectId, parentShotId, message } = parsed.data;

    const { getServerSupabaseClient } = await import('@/lib/supabase');
    supabase = await getServerSupabaseClient();
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

    // 1. Fetch parent shot (must be done)
    const { data: parentShot, error: parentError } = await supabase
      .from('shots')
      .select('*')
      .eq('id', parentShotId)
      .single();

    if (parentError || !parentShot) {
      return NextResponse.json({ error: 'Parent shot not found' }, { status: 404 });
    }

    if (parentShot.status !== 'done' || !parentShot.output_video_url) {
      return NextResponse.json({ error: 'Parent shot is not ready for editing' }, { status: 400 });
    }

    // 2. Fetch project assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', projectId);

    if (assetsError) throw assetsError;

    // 3. Resolve tags
    const { resolved: referencedAssets } = resolveTags(message, assets || []);

    // 4. Build video context
    const { instructions, contextSummary } = buildVideoContext({
      prompt: message,
      referencedAssets,
      priorShot: parentShot,
      baseVideoUrl: parentShot.output_video_url,
      isEdit: true,
    });

    // 5. Insert new edit version of the shot (inherits turn_index of the parent)
    const { data: shot, error: insertError } = await supabase
      .from('shots')
      .insert({
        project_id: projectId,
        turn_index: parentShot.turn_index,
        prompt: message,
        referenced_asset_ids: referencedAssets.map(a => a.id),
        parent_shot_id: parentShotId,
        status: 'generating',
        context_summary: contextSummary,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    createdShotId = shot.id;

    // 6. Generate edited video using stateful interactions editing if available
    const parentInteractionId = parentShot.context_summary?.interactionId || null;
    const provider = getProvider();

    const result = await provider.generateVideo({
      prompt: message,
      instructions,
      referenceImages: referencedAssets.map(a => a.url),
      referenceVideos: [],
      baseVideo: parentShot.output_video_url,
      previousInteractionId: parentInteractionId,
    });

    let finalUrl = '';

    if (result.url && !result.bytes) {
      // Mock provider returns local public URLs like "/demo/videos/edit.mp4"
      // We read the local file and upload it to Supabase Storage so it gets a real Supabase URL!
      try {
        const fs = require('fs');
        const path = require('path');
        const localPath = path.join(process.cwd(), 'public', result.url);

        if (fs.existsSync(localPath)) {
          const fileBytes = fs.readFileSync(localPath);
          const fileId = crypto.randomUUID();
          const filePath = `videos/${projectId}/${fileId}.mp4`;

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, fileBytes, {
              contentType: 'video/mp4',
              duplex: 'half',
            } as any);

          if (uploadError) {
            console.error('Supabase Storage mock upload error:', uploadError);
            finalUrl = result.url; // Fallback
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
      // Real provider: upload generated video buffer to storage
      const fileId = crypto.randomUUID();
      const filePath = `videos/${projectId}/${fileId}.mp4`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, result.bytes, {
          contentType: result.contentType || 'video/mp4',
          duplex: 'half',
        } as any);

      if (uploadError) {
        throw new Error(`Failed to upload generated video: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      finalUrl = publicUrl;
    } else {
      throw new Error('AI provider returned empty response.');
    }

    // 7. Update database record with final URL, status: done, and interaction ID
    const updatedSummary = {
      ...contextSummary,
      interactionId: result.interactionId || null,
    };

    const { data: completedShot, error: updateError } = await supabase
      .from('shots')
      .update({
        status: 'done',
        output_video_url: finalUrl,
        context_summary: updatedSummary,
      })
      .eq('id', shot.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ data: completedShot });
  } catch (error: any) {
    console.error('POST /api/shots/edit error:', error);

    if (createdShotId) {
      // Update DB record to error state
      await supabase
        .from('shots')
        .update({
          status: 'error',
          error: error.message || 'Editing failed',
        })
        .eq('id', createdShotId);
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
