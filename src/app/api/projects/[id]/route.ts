import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      const isNetwork =
        authError.message?.includes('fetch failed') ||
        authError.message?.includes('timeout') ||
        authError.message?.includes('Connect Timeout');
      if (isNetwork) {
        return NextResponse.json({ error: 'Supabase temporarily unreachable' }, { status: 503 });
      }
    }

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify ownership
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch assets ordered by created_at ascending
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true });

    if (assetsError) {
      throw assetsError;
    }

    // 3. Fetch shots ordered by turn_index and created_at ascending
    const { data: shots, error: shotsError } = await supabase
      .from('shots')
      .select('*')
      .eq('project_id', id)
      .order('turn_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (shotsError) {
      throw shotsError;
    }

    return NextResponse.json({
      data: {
        project,
        assets: assets || [],
        shots: shots || [],
      },
    });
  } catch (error: any) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
