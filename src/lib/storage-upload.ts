import type { SupabaseClient } from '@supabase/supabase-js';
import { compressVideoBuffer, compressImageBuffer } from './compress';

export async function uploadVideoToStorage(
  storage: SupabaseClient,
  projectId: string,
  bytes: Buffer,
  contentType = 'video/mp4'
): Promise<{ publicUrl: string; originalSize: number; compressedSize: number }> {
  const { bytes: compressed, originalSize, compressedSize } = await compressVideoBuffer(bytes, contentType);
  const fileId = crypto.randomUUID();
  const filePath = `videos/${projectId}/${fileId}.mp4`;

  const { error: uploadError } = await storage.storage.from('assets').upload(filePath, compressed, {
    contentType: 'video/mp4',
    duplex: 'half',
  } as any);

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = storage.storage.from('assets').getPublicUrl(filePath);

  return { publicUrl, originalSize, compressedSize };
}

export async function uploadImageToStorage(
  storage: SupabaseClient,
  projectId: string,
  bytes: Buffer,
  contentType = 'image/png'
): Promise<{ publicUrl: string; originalSize: number; compressedSize: number }> {
  const { bytes: compressed, originalSize, compressedSize } = await compressImageBuffer(bytes);
  const fileId = crypto.randomUUID();
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  const filePath = `assets/${projectId}/${fileId}.${ext}`;

  const { error: uploadError } = await storage.storage.from('assets').upload(filePath, compressed, {
    contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
    duplex: 'half',
  } as any);

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = storage.storage.from('assets').getPublicUrl(filePath);

  return { publicUrl, originalSize, compressedSize };
}
