import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerSupabase();

    // 1. Fetch asset first to check existence and source
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // 2. If it's stored in Supabase Storage, delete the file from the storage bucket
    if (asset.url.includes('/storage/v1/object/public/assets/')) {
      // Parse the relative file path after the public bucket name:
      // URL format: https://.../storage/v1/object/public/assets/uploads/PROJECT_ID/FILE.ext
      const parts = asset.url.split('/storage/v1/object/public/assets/');
      if (parts.length > 1) {
        const filePath = parts[1];
        console.log(`Deleting file from Storage: ${filePath}`);
        const { error: storageError } = await supabase.storage
          .from('assets')
          .remove([filePath]);

        if (storageError) {
          console.warn('Failed to delete asset file from storage:', storageError.message);
        }
      }
    }

    // 3. Delete DB record
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/assets/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
