import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { getServerSupabaseClient } = await import('@/lib/supabase');
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch target shot and parent project user_id
    const { data: shot, error: fetchError } = await supabase
      .from('shots')
      .select('*, projects(user_id)')
      .eq('id', id)
      .single();

    if (fetchError || !shot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    const projectUser = (shot as any).projects?.user_id;
    if (projectUser !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch all shots in the project to resolve descendant edits
    const { data: allShots, error: listError } = await supabase
      .from('shots')
      .select('id, parent_shot_id, output_video_url')
      .eq('project_id', shot.project_id);

    if (listError) {
      throw listError;
    }

    // 3. Find target shot and all of its descendants (child edits)
    const idsToDelete = [id];
    const urlsToDelete = shot.output_video_url ? [shot.output_video_url] : [];
    let added = true;

    while (added) {
      added = false;
      for (const s of allShots || []) {
        if (s.parent_shot_id && idsToDelete.includes(s.parent_shot_id) && !idsToDelete.includes(s.id)) {
          idsToDelete.push(s.id);
          if (s.output_video_url) {
            urlsToDelete.push(s.output_video_url);
          }
          added = true;
        }
      }
    }

    // 4. Delete files from Supabase Storage
    for (const url of urlsToDelete) {
      if (url.includes('/storage/v1/object/public/assets/')) {
        const parts = url.split('/storage/v1/object/public/assets/');
        if (parts.length > 1) {
          const filePath = parts[1];
          console.log(`Deleting shot video file: ${filePath}`);
          await supabase.storage.from('assets').remove([filePath]);
        }
      }
    }

    // 5. Delete all resolved DB shot rows
    const { error: deleteError } = await supabase
      .from('shots')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: 'Shot and descendants deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/shots/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
