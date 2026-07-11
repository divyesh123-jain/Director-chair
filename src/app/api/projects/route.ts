import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
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
    const body = await request.json().catch(() => ({}));
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const name = parsed.data.name || "Untitled Project";
    const supabase = getServerSupabase();
    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name })
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
