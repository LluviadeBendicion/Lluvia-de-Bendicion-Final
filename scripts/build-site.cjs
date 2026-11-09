const { copyFileSync, cpSync, existsSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const output = join(root, 'dist');
mkdirSync(output, { recursive: true });
for (const entry of [
  'index.html', 'assets', 'donaciones', 'estudio', 'Logo-oficial-lldb.jpg',
  'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'sw.js'
]) {
  cpSync(join(root, entry), join(output, entry), { recursive: true });
}

const intro = join(root, 'assets', 'intro-cinematografica-lldb.mp4');
const target = join(output, 'assets', 'intro-cinematografica-1080p.mp4');
if (!existsSync(target)) {
  const ffmpeg = process.env.LLDB_FFMPEG ||
    join(root, 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg');
  const filters = [
    'hqdn3d=0.8:0.6:1.1:0.9',
    'scale=1920:1080:flags=lanczos:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709',
    'setsar=1',
    'unsharp=5:5:0.42:5:5:0'
  ];
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', intro,
    '-map', '0:v:0', '-map', '0:a:0', '-vf', filters.join(','),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'copy', '-movflags', '+faststart', target
  ], { stdio: 'inherit' });
}
