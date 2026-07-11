import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { resolveTags, resolveShotTags } from '@/lib/tags';
import { buildVideoContext, splitAssetMedia, buildSceneNarrative } from '@/lib/prompt';
import { uploadVideoToStorage } from '@/lib/storage-upload';
import { z } from 'zod';

const extendShotSchema = z.object({
  projectId: z.string().uuid(),
  parentShotId: z.string().uuid(),
  /** Optional user direction — e.g. "Tom trips and falls". If omitted, auto-continue. */
  message: z.string().optional().default(''),
});

export async function POST(request: Request) {
  let createdShotId: string | null = null;
  let supabase: any = null;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = extendShotSchema.safeParse(body);

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

    // Load the shot we are extending from
    const { data: parentShot, error: parentError } = await supabase
      .from('shots')
      .select('*')
      .eq('id', parentShotId)
      .single();

    if (parentError || !parentShot) {
      return NextResponse.json({ error: 'Parent shot not found' }, { status: 404 });
    }

    if (parentShot.status !== 'done' || !parentShot.output_video_url) {
      return NextResponse.json({ error: 'Parent shot is not ready to extend' }, { status: 400 });
    }

    // Assets and all existing shots for tag resolution
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

    // Resolve any asset / shot tags from the user's optional direction
    const { resolved: referencedAssets } = resolveTags(message, assets || []);
    const { resolved: referencedShots } = resolveShotTags(message, allShots || []);

    // Build the scene narrative so the model knows exactly what was in the parent
    const sceneNarrative = buildSceneNarrative(parentShot);

    // The effective prompt: use user's direction if provided, otherwise auto-continue
    const effectivePrompt = message.trim()
      ? message
      : `Continue the video seamlessly from where Shot ${parentShot.turn_index + 1} ends.`;

    // IMPORTANT: The Gemini API does NOT support "baseVideo" for video extension.
    // We pass the parent video as a REFERENCE only (not baseVideoUrl) so the model
    // can see it visually, but we use interactions.create (not interactions.edit).
    const { instructions, contextSummary } = buildVideoContext({
      prompt: effectivePrompt,
      referencedAssets,
      referencedShots,
      priorShot: parentShot,
      baseVideoUrl: null,           // ← must be null; API rejects baseVideo for extends
      isEdit: false,
      isExtend: true,
      previousInteractionId: null,  // ← always fresh interaction for extends
      extraReferenceVideos: [parentShot.output_video_url], // ← pass as reference instead
      sceneNarrative,
    });

    // New top-level turn — not a version of the parent, but the next shot
    const topLevelCount = (allShots || []).filter((s: any) => s.parent_shot_id === null).length;
    const newTurnIndex = topLevelCount;

    // =====================================================
    // STRUCTURED LOG — Extend Shot
    // =====================================================
    console.log('\n[EXTEND SHOT] ==========================================');
    console.log(`  Parent Shot ID    : ${parentShot.id}`);
    console.log(`  Parent Turn Index : ${parentShot.turn_index}`);
    console.log(`  Parent Prompt     : "${parentShot.prompt}"`);
    console.log(`  Scene Narrative   : "${sceneNarrative}"`);
    console.log(`  User Direction    : "${message || '(none — auto-continue)'}"`);
    console.log(`  Effective Prompt  : "${effectivePrompt}"`);
    console.log(`  Prev Interaction  : none (extend always uses interactions.create)`);
    console.log(`  New Turn Index    : ${newTurnIndex}`);
    console.log(`  Omni Endpoint     : ${contextSummary.omniEndpoint}`);
    console.log(`  Final Instructions:`);
    instructions.forEach((inst, i) => console.log(`    [${i + 1}] ${inst}`));
    console.log(`  Referenced Assets : ${referencedAssets.map(a => `@${a.tag}`).join(', ') || 'none'}`);
    console.log('[EXTEND SHOT] ==========================================\n');

    const { data: shot, error: insertError } = await supabase
      .from('shots')
      .insert({
        project_id: projectId,
        // NEW top-level slot — not a version of the parent
        turn_index: newTurnIndex,
        prompt: effectivePrompt,
        referenced_asset_ids: referencedAssets.map(a => a.id),
        parent_shot_id: null,
        status: 'generating',
        context_summary: contextSummary,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    createdShotId = shot.id;

    const media = splitAssetMedia(referencedAssets);

    // Always include the parent shot video as the primary reference
    const referenceVideos = Array.from(
      new Set([
        parentShot.output_video_url,
        ...media.videos,
        ...referencedShots.map(s => s.videoUrl),
      ])
    );

    const provider = getProvider();
    const model = process.env.OMNI_MODEL_ID || 'gemini-omni-flash-preview';
    console.log(`[EXTEND SHOT] Calling provider.generateVideo — model: ${model}`);

    const result = await provider.generateVideo({
      prompt: effectivePrompt,
      instructions,
      referenceImages: media.images,
      referenceVideos,  // parent video is already in here as a reference
      referenceAudios: media.audios,
      baseVideo: null,             // ← MUST be null — API doesn't support video extension
      previousInteractionId: null, // ← fresh interaction.create
    });

    // =====================================================
    // RESPONSE LOG
    // =====================================================
    console.log('\n[EXTEND SHOT RESPONSE] ================================');
    console.log(`  Result Interaction ID : ${result.interactionId ?? 'none'}`);
    console.log(`  Has bytes             : ${result.bytes ? `yes (${result.bytes.byteLength} bytes)` : 'no'}`);
    console.log(`  Has url               : ${result.url ?? 'no'}`);
    console.log('[EXTEND SHOT RESPONSE] ================================\n');

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
      interactionId: result.interactionId || null,
      extendedFromShotId: parentShotId,
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

    console.log(`[EXTEND SHOT] Done — new shot ID: ${completedShot.id}, turn: ${newTurnIndex}, URL: ${finalUrl}`);
    return NextResponse.json({ data: completedShot });
  } catch (error: any) {
    console.error('POST /api/shots/extend error:', error);

    if (createdShotId && supabase) {
      await supabase
        .from('shots')
        .update({
          status: 'error',
          error: error.message || 'Extend failed',
        })
        .eq('id', createdShotId);
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
