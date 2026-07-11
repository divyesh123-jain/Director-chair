import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

let ffmpegPath: string | null = null;

async function getFfmpegPath(): Promise<string | null> {
  if (ffmpegPath && existsSync(ffmpegPath)) return ffmpegPath;

  const candidates: string[] = [];

  if (process.env.FFMPEG_PATH) {
    candidates.push(process.env.FFMPEG_PATH);
  }

  candidates.push(join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg'));

  try {
    const mod = await import('ffmpeg-static');
    const fromPkg = mod.default as string | undefined;
    if (fromPkg) candidates.unshift(fromPkg);
  } catch {
    // ignore — fall back to cwd path
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      ffmpegPath = candidate;
      return ffmpegPath;
    }
  }

  ffmpegPath = null;
  return null;
}

export async function compressVideoBuffer(
  input: Buffer,
  contentType = 'video/mp4'
): Promise<{ bytes: Buffer; originalSize: number; compressedSize: number }> {
  const originalSize = input.length;
  const ffmpeg = await getFfmpegPath();
  if (!ffmpeg) {
    return { bytes: input, originalSize, compressedSize: originalSize };
  }

  const id = randomUUID();
  const inPath = join(tmpdir(), `dc-in-${id}.mp4`);
  const outPath = join(tmpdir(), `dc-out-${id}.mp4`);

  try {
    await writeFile(inPath, input);
    await execFileAsync(ffmpeg, [
      '-y',
      '-i',
      inPath,
      '-c:v',
      'libx264',
      '-crf',
      '28',
      '-preset',
      'fast',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outPath,
    ]);
    const compressed = await readFile(outPath);
    return {
      bytes: compressed,
      originalSize,
      compressedSize: compressed.length,
    };
  } catch (err) {
    console.warn('Video compression failed, using original:', err);
    return { bytes: input, originalSize, compressedSize: originalSize };
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

export async function compressImageBuffer(input: Buffer): Promise<{
  bytes: Buffer;
  originalSize: number;
  compressedSize: number;
  contentType: string;
}> {
  const originalSize = input.length;
  try {
    const sharp = (await import('sharp')).default;
    const compressed = await sharp(input)
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return {
      bytes: compressed,
      originalSize,
      compressedSize: compressed.length,
      contentType: 'image/png',
    };
  } catch {
    return { bytes: input, originalSize, compressedSize: originalSize, contentType: 'image/png' };
  }
}

export async function concatVideosToBuffer(urls: string[]): Promise<Buffer> {
  const ffmpeg = await getFfmpegPath();
  if (!ffmpeg || urls.length === 0) {
    throw new Error('ffmpeg not available or no videos to combine');
  }

  const id = randomUUID();
  const listPath = join(tmpdir(), `dc-list-${id}.txt`);
  const outPath = join(tmpdir(), `dc-combined-${id}.mp4`);
  const tempFiles: string[] = [];

  try {
    const lines: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const fetchUrl = urls[i].startsWith('/')
        ? `http://localhost:${process.env.PORT || 3000}${urls[i]}`
        : urls[i];
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch video ${fetchUrl}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const partPath = join(tmpdir(), `dc-part-${id}-${i}.mp4`);
      await writeFile(partPath, buf);
      tempFiles.push(partPath);
      lines.push(`file '${partPath}'`);
    }

    await writeFile(listPath, lines.join('\n'));
    await execFileAsync(ffmpeg, [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outPath,
    ]);

    return await readFile(outPath);
  } finally {
    await unlink(listPath).catch(() => {});
    await unlink(outPath).catch(() => {});
    for (const f of tempFiles) await unlink(f).catch(() => {});
  }
}
