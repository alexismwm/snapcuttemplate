// scripts/fetch-ffmpeg-core.mjs
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argOut = process.argv[2];
const outBase = argOut ? resolve(__dirname, '..', argOut) : resolve(__dirname, '..', 'public');
const outDir = `${outBase}/ffmpeg`;

const targets = [
  { name: 'ffmpeg-core.js', minBytes: 100_000 },
  { name: 'ffmpeg-core.wasm', minBytes: 5_000_000 },
];

// For worker, try multiple possible filenames on different CDNs, save as ffmpeg-core.worker.js
const workerCandidates = ['ffmpeg-core.worker.js', '814.ffmpeg.js'];

const cdns = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/umd',
];

async function existsAndLargeEnough(path, minBytes) {
  try {
    const s = await stat(path);
    return s.size >= minBytes;
  } catch {
    return false;
  }
}

async function fetchToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ensureFile(name, minBytes) {
  const dest = `${outDir}/${name}`;
  if (await existsAndLargeEnough(dest, minBytes)) {
    console.log(`✓ ${name} exists and is large enough, skipping`);
    return;
  }
  let lastErr;
  for (const base of cdns) {
    const url = `${base}/${name}`;
    try {
      console.log(`↻ downloading ${url}`);
      const buf = await fetchToBuffer(url);
      if (buf.length < minBytes) throw new Error(`too small (${buf.length}B)`);
      await writeFile(dest, buf);
      console.log(`✓ saved ${name} (${buf.length}B)`);
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`⚠︎ failed from ${base}: ${e.message}`);
    }
  }
  throw new Error(`Failed to download ${name}: ${lastErr?.message || 'unknown error'}`);
}

async function ensureWorker() {
  const dest = `${outDir}/ffmpeg-core.worker.js`;
  if (await existsAndLargeEnough(dest, 5_000)) {
    console.log('✓ ffmpeg-core.worker.js exists and is large enough, skipping');
    return;
  }

  let lastErr;
  for (const base of cdns) {
    for (const candidate of workerCandidates) {
      const url = `${base}/${candidate}`;
      try {
        console.log(`↻ downloading ${url}`);
        const buf = await fetchToBuffer(url);
        if (buf.length < 5_000) throw new Error(`too small (${buf.length}B)`);
        await writeFile(dest, buf);
        console.log(`✓ saved ffmpeg-core.worker.js (${buf.length}B)`);
        return;
      } catch (e) {
        lastErr = e;
        console.warn(`⚠︎ failed worker from ${url}: ${e.message}`);
      }
    }
  }
  throw new Error(`Failed to download worker: ${lastErr?.message || 'unknown error'}`);
}

async function main() {
  console.log(`Output directory: ${outDir}`);
  await mkdir(outDir, { recursive: true });
  for (const t of targets) {
    await ensureFile(t.name, t.minBytes);
  }
  await ensureWorker();
}

main().catch((e) => {
  console.error('fetch-ffmpeg-core failed:', e);
  process.exit(1);
}); 