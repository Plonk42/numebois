/**
 * Sound pipeline: takes the recordings of `src/scene/audio/sound-catalog.ts` (Freesound
 * previews, CC0, cached in `assets-private/sounds/previews/`), cuts them, makes the loops
 * seamless, evens their loudness and encodes them in mono Opus under
 * `public/assets/sounds/` (committed, see LICENSES.md). Writes the manifest
 * `src/scene/audio/sounds.gen.ts`. Needs ffmpeg with libopus.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOUND_CATALOG,
  type CallSound,
  type LoopSound,
  type SoundName,
} from '../src/scene/audio/sound-catalog';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'assets-private', 'sounds', 'previews');
const OUT_DIR = join(ROOT, 'public', 'assets', 'sounds');
const MANIFEST = join(ROOT, 'src', 'scene', 'audio', 'sounds.gen.ts');
const RATE = 48000;
/** Cross-fade that closes a loop, in seconds. */
const SEAM = 2;
/** Silence between two cuts of a calls file. */
const GAP = 0.25;
const LOOP_RMS_DB = -24;
const CALL_RMS_DB = -18;
const PEAK = 0.9;
const BITRATE = { loop: '32k', calls: '40k' };

const fromDb = (db: number) => 10 ** (db / 20);

async function preview(id: number, user: number): Promise<string> {
  const file = join(CACHE, `${id}_${user}.mp3`);
  if (existsSync(file)) return file;
  const url = `https://cdn.freesound.org/previews/${Math.floor(id / 1000)}/${id}_${user}-hq.mp3`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, new Uint8Array(await response.arrayBuffer()));
  return file;
}

function decode(file: string): Float32Array {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', `${RATE}`, '-f', 'f32le', '-'],
    { maxBuffer: 1 << 30 },
  );
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}

function encode(samples: Float32Array, file: string, bitrate: string): void {
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ar',
      `${RATE}`,
      '-ac',
      '1',
      '-i',
      '-',
      '-c:a',
      'libopus',
      '-b:a',
      bitrate,
      '-application',
      'audio',
      '-map_metadata',
      '-1',
      file,
    ],
    { input: Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength) },
  );
}

function rms(x: Float32Array): number {
  let sum = 0;
  for (const v of x) sum += v * v;
  return Math.sqrt(sum / Math.max(1, x.length));
}

/** Scale to a loudness, without letting a peak go above PEAK. */
function level(x: Float32Array, targetDb: number): Float32Array {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(fromDb(targetDb) / rms(x), PEAK / peak);
  return x.map((v) => v * gain);
}

function window(x: Float32Array, from: number, to: number, name: string): Float32Array {
  const a = Math.round(from * RATE);
  const b = Math.round(to * RATE);
  if (b > x.length) throw new Error(`${name}: ${to} s is past the end (${x.length / RATE} s)`);
  return x.slice(a, b);
}

/** The window plus SEAM seconds, whose end is cross-faded into its start (equal power). */
function loop(x: Float32Array, sound: LoopSound, name: string): Float32Array {
  const w = window(x, sound.from, sound.from + sound.seconds + SEAM, name);
  const n = Math.round(sound.seconds * RATE);
  const fade = Math.round(SEAM * RATE);
  const out = w.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const t = (i / fade) * (Math.PI / 2);
    out[i] = w[i] * Math.sin(t) + w[n + i] * Math.cos(t);
  }
  return level(out, LOOP_RMS_DB);
}

function calls(x: Float32Array, sound: CallSound, name: string) {
  const pieces = sound.cuts.map(([from, to]) => {
    const piece = window(x, from, to, name);
    const fadeIn = Math.round(0.02 * RATE);
    const fadeOut = Math.round(0.15 * RATE);
    for (let i = 0; i < fadeIn; i++) piece[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i++) piece[piece.length - 1 - i] *= i / fadeOut;
    return level(piece, CALL_RMS_DB);
  });
  const gap = Math.round(GAP * RATE);
  const out = new Float32Array(pieces.reduce((n, p) => n + p.length + gap, 0));
  const cuts: [number, number][] = [];
  let at = 0;
  for (const piece of pieces) {
    out.set(piece, at);
    cuts.push([at / RATE, piece.length / RATE]);
    at += piece.length + gap;
  }
  return { samples: out, cuts };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

async function main(): Promise<void> {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const lines: string[] = [];
  let total = 0;
  for (const [name, sound] of Object.entries(SOUND_CATALOG) as [
    SoundName,
    LoopSound | CallSound,
  ][]) {
    const x = decode(await preview(sound.freesound, sound.user));
    const file = join(OUT_DIR, `${name}.ogg`);
    if (sound.kind === 'loop') {
      const samples = loop(x, sound, name);
      encode(samples, file, BITRATE.loop);
      lines.push(
        `  ${name}: { file: 'assets/sounds/${name}.ogg', seconds: ${round(samples.length / RATE)}, cuts: [] },`,
      );
    } else {
      const { samples, cuts } = calls(x, sound, name);
      encode(samples, file, BITRATE.calls);
      const list = cuts.map(([a, d]) => `[${round(a)}, ${round(d)}]`).join(', ');
      lines.push(
        `  ${name}: { file: 'assets/sounds/${name}.ogg', seconds: ${round(samples.length / RATE)}, cuts: [${list}] },`,
      );
    }
    const bytes = statSync(file).size;
    total += bytes;
    console.log(`${name}: ${(bytes / 1024).toFixed(0)} ko`);
  }
  writeFileSync(
    MANIFEST,
    `// Generated by \`npm run sounds\` from the Freesound recordings of the catalog. Do not edit.
import type { SoundName } from './sound-catalog';

export interface SoundFile {
  /** Relative to the site base. */
  file: string;
  seconds: number;
  /** Start and duration of each call; empty for a loop. */
  cuts: readonly (readonly [number, number])[];
}

export const SOUND_FILES = {
${lines.join('\n')}
} as const satisfies Record<SoundName, SoundFile>;

/** Size of all the sound files, in bytes. */
export const SOUND_BYTES = ${total};
`,
  );
  console.log(
    `${readdirSync(OUT_DIR).length} sons, ${(total / 1024).toFixed(0)} ko -> public/assets/sounds ; manifeste src/scene/audio/sounds.gen.ts`,
  );
}

await main();
