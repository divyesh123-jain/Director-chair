import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { concatVideosToBuffer } from '@/lib/compress';
import { z } from 'zod';

const exportSchema = z.object({
  projectId: z.string().uuid(),
  videoUrls: z.array(z.string().url()).min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { projectId, videoUrls } = parsed.data;

    const { getServerSupabaseClient } = await import('@/lib/supabase');
    const supabase = await getServerSupabaseClient();
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

    const combined = await concatVideosToBuffer(videoUrls);

    return new NextResponse(new Uint8Array(combined), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="timeline-${projectId}.mp4"`,
      },
    });
  } catch (error: any) {
    console.error('POST /api/timeline/export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
