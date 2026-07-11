import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getProvider } from '@/lib/ai/provider';
import { resolveTags } from '@/lib/tags';
import { buildVideoContext } from '@/lib/prompt';
import { z } from 'zod';

const generateShotSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1),
});

export async function POST(request: Request) {
  let createdShotId: string | null = null;
  const supabase = getServerSupabase();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = generateShotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { projectId, message } = parsed.data;

    // 1. Fetch assets and existing shots to build context
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', projectId);

    if (assetsError) throw assetsError;

    const { data: shots, error: shotsError } = await supabase
      .from('shots')
      .select('*')
      .eq('project_id', projectId);

    if (shotsError) throw shotsError;

    // 2. Resolve tags
    const { resolved: referencedAssets } = resolveTags(message, assets || []);

    // 3. Find the prior shot for consistency (last top-level done shot)
    const topLevelShots = (shots || []).filter(
      (s: any) => s.parent_shot_id === null && s.status === 'done'
    );
    const priorShot = topLevelShots.length > 0 ? topLevelShots[topLevelShots.length - 1] : null;

    // 4. Build video context instructions and summary
    const { instructions, contextSummary } = buildVideoContext({
      prompt: message,
      referencedAssets,
      priorShot,
      baseVideoUrl: null,
      isEdit: false,
    });

    // 5. Calculate turn_index (total count of top-level shots)
    const turnIndex = (shots || []).filter((s: any) => s.parent_shot_id === null).length;

    // 6. Insert initial shot row as 'pending' / 'generating'
    const { data: shot, error: insertError } = await supabase
      .from('shots')
      .insert({
        project_id: projectId,
        turn_index: turnIndex,
        prompt: message,
        referenced_asset_ids: referencedAssets.map(a => a.id),
        parent_shot_id: null,
        status: 'generating',
        context_summary: contextSummary,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    createdShotId = shot.id;

    // 7. Generate video using the active AI provider
    const provider = getProvider();
    const result = await provider.generateVideo({
      prompt: message,
      instructions,
      referenceImages: referencedAssets.map(a => a.url),
      referenceVideos: priorShot?.output_video_url ? [priorShot.output_video_url] : [],
      baseVideo: null,
    });

    let finalUrl = '';

    if (result.url && !result.bytes) {
      // Mock provider returns local public URLs like "/demo/videos/shot1.mp4"
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

    // 8. Update database record with final URL, status: done, and interaction ID
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
    console.error('POST /api/shots/generate error:', error);

    if (createdShotId) {
      // Update DB record to error state
      await supabase
        .from('shots')
        .update({
          status: 'error',
          error: error.message || 'Generation failed',
        })
        .eq('id', createdShotId);
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
