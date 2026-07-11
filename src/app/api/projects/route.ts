import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: projects });
  } catch (error: any) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Project Creation Auth Failed:', { authError, user });
      return NextResponse.json({ error: 'Unauthorized: ' + (authError?.message || 'No user') }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const name = parsed.data.name || "Untitled Project";
    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name, user_id: user.id })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: project });
  } catch (error: any) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
