import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const tag = formData.get('tag') as string | null;

    if (!file || !projectId || !tag) {
      return NextResponse.json({ error: 'Missing required fields: file, projectId, tag' }, { status: 400 });
    }

    // Validate tag format
    if (!/^[A-Za-z0-9_]+$/.test(tag)) {
      return NextResponse.json({ error: 'Tag must be alphanumeric with underscores only' }, { status: 400 });
    }

    const { getServerSupabaseClient } = await import('@/lib/supabase');
    const supabase = await getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: projectCheck, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!projectCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Verify tag is unique (case-insensitive)
    const { data: existingAssets, error: tagCheckError } = await supabase
      .from('assets')
      .select('tag')
      .eq('project_id', projectId);

    if (tagCheckError) {
      throw tagCheckError;
    }

    const tagExists = existingAssets?.some(
      (a: any) => a.tag.toLowerCase() === tag.toLowerCase()
    );

    if (tagExists) {
      return NextResponse.json(
        { error: `Tag @${tag} is already in use for this project.` },
        { status: 409 }
      );
    }

    // 2. Infer type from mime-type
    let type: 'image' | 'video' | 'audio' = 'image';
    if (file.type.startsWith('video/')) {
      type = 'video';
    } else if (file.type.startsWith('audio/')) {
      type = 'audio';
    }

    // 3. Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileId = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'bin';
    const filePath = `uploads/${projectId}/${fileId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        duplex: 'half',
      } as any);

    if (uploadError) {
      console.error('Upload to storage failed:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath);

    // 4. Insert database record
    const { data: newAsset, error: insertError } = await supabase
      .from('assets')
      .insert({
        project_id: projectId,
        type,
        tag,
        url: publicUrl,
        prompt: `Uploaded file: ${file.name}`,
        source: 'upload',
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ data: newAsset });
  } catch (error: any) {
    console.error('POST /api/assets/upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

