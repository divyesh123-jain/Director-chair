import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { buildVideoContext, splitAssetMedia } from '@/lib/prompt';
import { uploadVideoToStorage } from '@/lib/storage-upload';
import { z } from 'zod';

const regenerateSchema = z.object({
  projectId: z.string().uuid(),
  shotId: z.string().uuid(),
});

export async function POST(request: Request) {
  let supabase: any = null;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = regenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { projectId, shotId } = parsed.data;

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

    const { data: sourceShot, error: shotError } = await supabase
      .from('shots')
      .select('*')
      .eq('id', shotId)
      .single();

    if (shotError || !sourceShot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    const storage = getServerSupabase();

    const { data: assets } = await supabase.from('assets').select('*').eq('project_id', projectId);
    const referencedAssets = (assets || []).filter((a: any) =>
      sourceShot.referenced_asset_ids.includes(a.id)
    );

    const isEdit = !!sourceShot.parent_shot_id;
    let priorShot = null;
    let parentShot = null;

    if (isEdit && sourceShot.parent_shot_id) {
      const { data } = await supabase
        .from('shots')
        .select('*')
        .eq('id', sourceShot.parent_shot_id)
        .single();
      parentShot = data;
      priorShot = data;
    } else if (sourceShot.turn_index > 0) {
      const { data: shots } = await supabase
        .from('shots')
        .select('*')
        .eq('project_id', projectId)
        .eq('turn_index', sourceShot.turn_index - 1)
        .is('parent_shot_id', null)
        .eq('status', 'done');
      priorShot = shots?.[shots.length - 1] || null;
    }

    const ctx = sourceShot.context_summary;
    const { instructions, contextSummary } = buildVideoContext({
      prompt: sourceShot.prompt,
      referencedAssets,
      referencedShots: ctx?.referencedShots || [],
      priorShot: isEdit ? parentShot : priorShot,
      baseVideoUrl: isEdit ? parentShot?.output_video_url || null : null,
      isEdit,
      previousInteractionId: ctx?.previousInteractionId || null,
    });

    const { data: newShot, error: insertError } = await supabase
      .from('shots')
      .insert({
        project_id: projectId,
        turn_index: sourceShot.turn_index,
        prompt: sourceShot.prompt,
        referenced_asset_ids: sourceShot.referenced_asset_ids,
        parent_shot_id: sourceShot.parent_shot_id,
        status: 'generating',
        context_summary: contextSummary,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    const media = splitAssetMedia(referencedAssets);
    const provider = getProvider();

    const result = await provider.generateVideo({
      prompt: sourceShot.prompt,
      instructions,
      referenceImages: media.images,
      referenceVideos: [],
      referenceAudios: [],
      baseVideo: null,
      previousInteractionId: isEdit ? ctx?.previousInteractionId || null : null,
      isEdit,
    });

    let finalUrl = '';
    let originalSize: number | null = null;
    let compressedSize: number | null = null;

    if (result.bytes) {
      const uploaded = await uploadVideoToStorage(storage, projectId, result.bytes, result.contentType);
      finalUrl = uploaded.publicUrl;
      originalSize = uploaded.originalSize;
      compressedSize = uploaded.compressedSize;
    } else if (result.url) {
      finalUrl = result.url;
    } else {
      throw new Error('AI provider returned empty response.');
    }

    const updatedSummary = {
      ...contextSummary,
      interactionId: result.interactionId || ctx?.previousInteractionId || null,
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
      .eq('id', newShot.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ data: completedShot });
  } catch (error: any) {
    console.error('POST /api/shots/regenerate error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
