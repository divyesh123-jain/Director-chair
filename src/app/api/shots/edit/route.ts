import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { resolveTags, resolveShotTags } from '@/lib/tags';
import { buildVideoContext, splitAssetMedia } from '@/lib/prompt';
import { uploadVideoToStorage } from '@/lib/storage-upload';
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

    const { data: projectCheck } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!projectCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storage = getServerSupabase();

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

    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', projectId);

    if (assetsError) throw assetsError;

    const { data: allShots, error: shotsError } = await supabase
      .from('shots')
      .select('*')
      .eq('project_id', projectId);

    if (shotsError) throw shotsError;

    const { resolved: referencedAssets } = resolveTags(message, assets || []);
    const { resolved: referencedShots } = resolveShotTags(message, allShots || [], {
      excludeTurnIndex: parentShot.turn_index,
    });

    const parentInteractionId = parentShot.context_summary?.interactionId || null;

    const { instructions, contextSummary } = buildVideoContext({
      prompt: message,
      referencedAssets,
      referencedShots,
      priorShot: parentShot,
      baseVideoUrl: parentShot.output_video_url,
      isEdit: true,
      previousInteractionId: parentInteractionId,
    });

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

    const media = splitAssetMedia(referencedAssets);
    const shotRefVideos = referencedShots.map(s => s.videoUrl);
    const referenceVideos = Array.from(new Set([...media.videos, ...shotRefVideos]));
    const provider = getProvider();

    const result = await provider.generateVideo({
      prompt: message,
      instructions,
      referenceImages: media.images,
      referenceVideos,
      referenceAudios: media.audios,
      baseVideo: parentShot.output_video_url,
      previousInteractionId: parentInteractionId,
    });

    let finalUrl = '';
    let originalSize: number | null = null;
    let compressedSize: number | null = null;

    if (result.url && !result.bytes) {
      try {
        const fs = require('fs');
        const path = require('path');
        const localPath = path.join(process.cwd(), 'public', result.url);

        if (fs.existsSync(localPath)) {
          const fileBytes = fs.readFileSync(localPath);
          const uploaded = await uploadVideoToStorage(storage, projectId, fileBytes);
          finalUrl = uploaded.publicUrl;
          originalSize = uploaded.originalSize;
          compressedSize = uploaded.compressedSize;
        } else {
          finalUrl = result.url;
        }
      } catch (err) {
        console.error('Failed to read mock file for upload:', err);
        finalUrl = result.url || '';
      }
    } else if (result.bytes) {
      const uploaded = await uploadVideoToStorage(storage, projectId, result.bytes, result.contentType);
      finalUrl = uploaded.publicUrl;
      originalSize = uploaded.originalSize;
      compressedSize = uploaded.compressedSize;
    } else {
      throw new Error('AI provider returned empty response.');
    }

    const updatedSummary = {
      ...contextSummary,
      interactionId: result.interactionId || parentInteractionId,
      originalSize,
      compressedSize,
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

    if (createdShotId && supabase) {
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
