import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const imgDir = join(root, 'public/demo/images');
const vidDir = join(root, 'public/demo/videos');

// Minimal 1x1 PNG (indigo pixel)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  await mkdir(imgDir, { recursive: true });
  await mkdir(vidDir, { recursive: true });

  for (const name of ['hero.png', 'spaceship.png', 'bridge.png']) {
    await writeFile(join(imgDir, name), TINY_PNG);
  }

  let ffmpeg = null;
  try {
    const mod = await import('ffmpeg-static');
    ffmpeg = mod.default;
  } catch {
    console.warn('ffmpeg-static not available; writing placeholder video bytes');
  }

  for (const name of ['shot1.mp4', 'shot2.mp4', 'shot3.mp4', 'edit.mp4']) {
    const out = join(vidDir, name);
    if (ffmpeg) {
      await execFileAsync(ffmpeg, [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0x312e81:s=320x180:d=2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        out,
      ]);
    } else {
      await writeFile(out, Buffer.from('placeholder'));
    }
  }

  console.log('Demo assets written to public/demo/');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
