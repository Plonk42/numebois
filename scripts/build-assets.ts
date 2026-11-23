/**
 * Asset pipeline: extracts the models listed in `src/scene/asset-catalog.ts` from the local
 * KayKit zips (`assets/*.zip`, never committed), paints the extended atlas, optimises
 * everything into one GLB under `public/assets/` (committed, CC0: see LICENSES.md) and
 * writes the typed manifest `src/scene/assets.gen.ts`. The animals of
 * `src/scene/animal-catalog.ts` go the same way from the Quaternius zip, into their own GLB
 * and manifest (`src/scene/animals.gen.ts`).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document,
  NodeIO,
  type AnimationChannel,
  type JSONDocument,
  type Node,
  type Primitive,
} from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import {
  dedup,
  joinPrimitives,
  mergeDocuments,
  meshopt,
  prune,
  resample,
  transformPrimitive,
  weld,
} from '@gltf-transform/functions';
import { unzipSync } from 'fflate';
import { MeshoptEncoder } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { Color, LinearSRGBColorSpace, Matrix4, SRGBColorSpace } from 'three';
import {
  ANIMAL_CATALOG,
  ANIMAL_CLIPS,
  ANIMAL_ZIP_PREFIX,
  type AnimalClip,
  type AnimalSource,
} from '../src/scene/animal-catalog';
import {
  CATALOG,
  PACK_TEXTURES,
  PACK_ZIPS,
  type ModelSource,
  type Pack,
} from '../src/scene/asset-catalog';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  ATLAS_SIZE,
  CELL_U,
  CELL_V,
  SWATCHES,
  hexCellTarget,
  paintAtlas,
  type SwatchDef,
} from '../src/scene/atlas';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'assets');
const OUT_FILE = 'kaykit.glb';
const MANIFEST = join(ROOT, 'src', 'scene', 'assets.gen.ts');
const ANIMAL_FILE = 'animals.glb';
const ANIMAL_MANIFEST = join(ROOT, 'src', 'scene', 'animals.gen.ts');

interface Geometry {
  positions: Float32Array<ArrayBuffer>;
  normals: Float32Array<ArrayBuffer>;
  uvs: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

type Files = Map<string, Uint8Array>;

function loadPack(pack: Pack): Files | null {
  const zipPath = join(ROOT, 'assets', PACK_ZIPS[pack]);
  if (!existsSync(zipPath)) return null;
  const wanted = new Set<string>([PACK_TEXTURES[pack]]);
  for (const source of Object.values<ModelSource>(CATALOG)) {
    if (source.pack !== pack) continue;
    wanted.add(`${source.file}.gltf`);
    wanted.add(`${source.file}.bin`);
  }
  const entries = unzipSync(readFileSync(zipPath), {
    filter: (file) => file.name.includes('/Assets/gltf/') && wanted.has(basename(file.name)),
  });
  const files: Files = new Map();
  for (const [name, data] of Object.entries(entries)) files.set(basename(name), data);
  return files;
}

function readTexture(files: Files, pack: Pack): Uint8Array {
  const png = PNG.sync.read(Buffer.from(files.get(PACK_TEXTURES[pack])!));
  if (png.width !== ATLAS_SIZE || png.height !== ATLAS_SIZE) {
    throw new Error(
      `${PACK_TEXTURES[pack]}: expected ${ATLAS_SIZE}², got ${png.width}×${png.height}`,
    );
  }
  return new Uint8Array(png.data);
}

async function readGeometry(io: NodeIO, files: Files, file: string): Promise<Geometry> {
  const json = JSON.parse(new TextDecoder().decode(files.get(`${file}.gltf`)!));
  // Textures are replaced by the shared atlas: drop them so no image file is needed.
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials ?? []) {
    delete material.pbrMetallicRoughness?.baseColorTexture;
  }
  const resources: Record<string, Uint8Array> = {};
  for (const buffer of json.buffers ?? []) resources[buffer.uri] = files.get(basename(buffer.uri))!;
  const doc = await io.readJSON({ json, resources } as JSONDocument);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const nor = prim.getAttribute('NORMAL')!;
      const uv = prim.getAttribute('TEXCOORD_0')!;
      const idx = prim.getIndices();
      const base = positions.length / 3;
      const p = [0, 0, 0];
      const n = [0, 0, 0];
      const t = [0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        nor.getElement(i, n);
        uv.getElement(i, t);
        positions.push(
          m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        );
        const nx = m[0] * n[0] + m[4] * n[1] + m[8] * n[2];
        const ny = m[1] * n[0] + m[5] * n[1] + m[9] * n[2];
        const nz = m[2] * n[0] + m[6] * n[1] + m[10] * n[2];
        const len = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / len, ny / len, nz / len);
        uvs.push(t[0], t[1]);
      }
      const count = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i < count; i++) indices.push(base + (idx ? idx.getScalar(i) : i));
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

/** Keep the listed triangles and compact the vertices. */
function subset(g: Geometry, triangles: number[]): Geometry {
  const remap = new Map<number, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const t of triangles) {
    for (let k = 0; k < 3; k++) {
      const v = g.indices[t * 3 + k];
      let nv = remap.get(v);
      if (nv === undefined) {
        nv = positions.length / 3;
        remap.set(v, nv);
        positions.push(g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]);
        normals.push(g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]);
        uvs.push(g.uvs[v * 2], g.uvs[v * 2 + 1]);
      }
      indices.push(nv);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function bounds(g: Geometry): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], g.positions[i + a]);
      max[a] = Math.max(max[a], g.positions[i + a]);
    }
  }
  return { min, max };
}

/**
 * Leaf tufts of a KayKit tree: connected pieces of the faces mapped on the leaf row.
 * KayKit splits vertices on hard edges, so pieces are joined by position.
 * Sorted like the Blender prototype: most faces first, then lowest centre.
 */
function leafParts(g: Geometry): Geometry[] {
  const triCount = g.indices.length / 3;
  const leaf: number[] = [];
  for (let t = 0; t < triCount; t++) {
    let v = 0;
    for (let k = 0; k < 3; k++) v += g.uvs[g.indices[t * 3 + k] * 2 + 1];
    if (v / 3 < CELL_V) leaf.push(t);
  }
  const parent = new Map<number, number>(leaf.map((t) => [t, t]));
  const find = (i: number): number => {
    while (parent.get(i) !== i) {
      parent.set(i, parent.get(parent.get(i)!)!);
      i = parent.get(i)!;
    }
    return i;
  };
  const owner = new Map<string, number>();
  for (const t of leaf) {
    for (let k = 0; k < 3; k++) {
      const v = g.indices[t * 3 + k] * 3;
      const key = `${g.positions[v].toFixed(3)},${g.positions[v + 1].toFixed(3)},${g.positions[v + 2].toFixed(3)}`;
      const other = owner.get(key);
      if (other === undefined) owner.set(key, t);
      else parent.set(find(t), find(other));
    }
  }
  const groups = new Map<number, number[]>();
  for (const t of leaf) {
    const root = find(t);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t);
  }
  const parts = [...groups.values()].map((triangles) => subset(g, triangles));
  const centerY = (p: Geometry) => {
    const b = bounds(p);
    return (b.min[1] + b.max[1]) / 2;
  };
  return parts.sort((a, b) => b.indices.length - a.indices.length || centerY(a) - centerY(b));
}

function recenter(g: Geometry): void {
  const b = bounds(g);
  for (let i = 0; i < g.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) g.positions[i + a] -= (b.min[a] + b.max[a]) / 2;
  }
}

/** Move the UVs of a Medieval Hexagon model to the cells copied into our atlas. */
function remapHexUvs(name: string, g: Geometry): void {
  for (let i = 0; i < g.uvs.length; i += 2) {
    const col = Math.min(ATLAS_COLS - 1, Math.floor(g.uvs[i] / CELL_U));
    const row = Math.min(ATLAS_ROWS - 1, Math.floor(g.uvs[i + 1] / CELL_V));
    const target = hexCellTarget(col, row);
    if (!target) {
      throw new Error(`${name}: hexagon atlas cell (${col}, ${row}) is not imported in atlas.ts`);
    }
    g.uvs[i] += (target.col - col) * CELL_U;
    g.uvs[i + 1] += (target.row - row) * CELL_V;
  }
}

function cellPixels(data: Uint8Array, col: number, row: number): Uint8Array {
  const cw = ATLAS_SIZE / ATLAS_COLS;
  const ch = ATLAS_SIZE / ATLAS_ROWS;
  const out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const from = ((row * ch + y) * ATLAS_SIZE + col * cw) * 4;
    out.set(data.subarray(from, from + cw * 4), y * cw * 4);
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function buildAtlas(forest: Uint8Array, hexTexture: Uint8Array): Uint8Array {
  const atlas = paintAtlas(ATLAS_SIZE, { forest, hex: hexTexture });
  for (const [name, swatch] of Object.entries<SwatchDef>(SWATCHES)) {
    if (
      swatch.source.kind === 'original' &&
      !sameBytes(
        cellPixels(atlas, swatch.col, swatch.row),
        cellPixels(forest, swatch.col, swatch.row),
      )
    ) {
      throw new Error(`Atlas: original cell ${name} was modified`);
    }
    if (
      swatch.source.kind === 'hex' &&
      !sameBytes(
        cellPixels(atlas, swatch.col, swatch.row),
        cellPixels(hexTexture, swatch.source.col, swatch.source.row),
      )
    ) {
      throw new Error(`Atlas: hexagon cell ${name} was not copied exactly`);
    }
  }
  return atlas;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function loadAnimalPack(): Files | null {
  const dir = join(ROOT, 'assets');
  const zip = existsSync(dir)
    ? readdirSync(dir).find((f) => f.startsWith(ANIMAL_ZIP_PREFIX) && f.endsWith('.zip'))
    : undefined;
  if (!zip) return null;
  const wanted = new Set(Object.values<AnimalSource>(ANIMAL_CATALOG).map((s) => `${s.file}.gltf`));
  const entries = unzipSync(readFileSync(join(dir, zip)), {
    filter: (file) => file.name.includes('/glTF/') && wanted.has(basename(file.name)),
  });
  const files: Files = new Map();
  for (const [name, data] of Object.entries(entries)) files.set(basename(name), data);
  return files;
}

/** The pack's browns look dull on the KayKit grass (#9): livelier colours, in sRGB. */
const VIVID = { saturation: 1.35, lightness: 1.1 };

function vivid(linear: readonly number[]): [number, number, number] {
  const color = new Color().setRGB(linear[0], linear[1], linear[2], LinearSRGBColorSpace);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, SRGBColorSpace);
  color.setHSL(
    hsl.h,
    Math.min(1, hsl.s * VIVID.saturation),
    Math.min(1, hsl.l * VIVID.lightness),
    SRGBColorSpace,
  );
  return [color.r, color.g, color.b];
}

/** Material colour into a vertex colour, so the whole animal shares one material. */
function bakeColour(doc: Document, prim: Primitive): void {
  const rgb = vivid(prim.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1]);
  const count = prim.getAttribute('POSITION')!.getCount();
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colours.set(rgb, i * 3);
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute(
    'COLOR_0',
    doc.createAccessor().setType('VEC3').setArray(colours).setBuffer(buffer),
  );
  prim.setAttribute('TEXCOORD_0', null);
}

interface AnimalInfo {
  triangles: number;
  min: number[];
  max: number[];
  clips: Record<AnimalClip, number>;
}

/** Keep and rename the gentle clips, drop the others; returns their durations. */
function keepGentleClips(
  doc: Document,
  name: string,
  source: AnimalSource,
): Record<AnimalClip, number> {
  const root = doc.getRoot();
  const joints = root.listSkins()[0].listJoints();
  const ours = new Map(Object.entries(source.clips).map(([clip, theirs]) => [theirs, clip]));
  const clips: Partial<Record<AnimalClip, number>> = {};
  for (const animation of root.listAnimations()) {
    const clip = ours.get(animation.getName()) as AnimalClip | undefined;
    if (!clip) {
      // Its samplers would otherwise keep their accessors in the file.
      for (const sampler of animation.listSamplers()) sampler.dispose();
      animation.dispose();
      continue;
    }
    animation.setName(`${name}:${clip}`);
    // IK targets are animated too, but only joints deform the mesh.
    for (const channel of animation.listChannels()) {
      if (!joints.includes(channel.getTargetNode()!)) dropChannel(channel);
    }
    clips[clip] = Math.max(
      ...animation.listSamplers().map((s) => s.getInput()!.getMax([])[0] as number),
    );
  }
  const missing = ANIMAL_CLIPS.filter((clip) => clips[clip] === undefined);
  if (missing.length > 0) throw new Error(`${name}: clips not found: ${missing.join(', ')}`);
  return clips as Record<AnimalClip, number>;
}

/** Skin a rigid primitive fully to one joint, with the attribute types of `like`. */
function skinToJoint(doc: Document, prim: Primitive, joint: number, like: Primitive): void {
  const count = prim.getAttribute('POSITION')!.getCount();
  const likeJoints = like.getAttribute('JOINTS_0')!;
  const likeWeights = like.getAttribute('WEIGHTS_0')!;
  const joints = new (likeJoints.getArray()!.constructor as Uint8ArrayConstructor)(count * 4);
  const weights = new (likeWeights.getArray()!.constructor as Float32ArrayConstructor)(count * 4);
  let full = 1;
  if (likeWeights.getNormalized()) full = weights instanceof Uint8Array ? 255 : 65535;
  for (let i = 0; i < count; i++) {
    joints[i * 4] = joint;
    weights[i * 4] = full;
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const accessor = (array: Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer>) =>
    doc.createAccessor().setType('VEC4').setArray(array).setBuffer(buffer);
  prim.setAttribute('JOINTS_0', accessor(joints));
  prim.setAttribute('WEIGHTS_0', accessor(weights).setNormalized(likeWeights.getNormalized()));
}

/** Remove a channel with its sampler, so prune drops their accessors. */
function dropChannel(channel: AnimationChannel): void {
  const sampler = channel.getSampler();
  channel.dispose();
  sampler?.dispose();
}

function restValue(node: Node, path: string | null): number[] | null {
  if (path === 'rotation') return node.getRotation();
  if (path === 'translation') return node.getTranslation();
  if (path === 'scale') return node.getScale();
  return null;
}

function holdsRest(channel: AnimationChannel): boolean {
  const rest = restValue(channel.getTargetNode()!, channel.getTargetPath());
  if (!rest) return false;
  const output = channel.getSampler()!.getOutput()!;
  const value: number[] = [];
  for (let i = 0; i < output.getCount(); i++) {
    output.getElement(i, value);
    // q and -q are the same rotation.
    const sign = rest.length === 4 && value[3] * rest[3] < 0 ? -1 : 1;
    if (value.some((v, a) => Math.abs(sign * v - rest[a]) > 1e-4)) return false;
  }
  return true;
}

/** Channels that only hold the rest pose change nothing: most of the file without them. */
function dropRestChannels(doc: Document): void {
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) if (holdsRest(channel)) dropChannel(channel);
  }
}

async function prepareAnimal(
  io: NodeIO,
  files: Files,
  name: string,
  source: AnimalSource,
): Promise<{ doc: Document; info: AnimalInfo }> {
  const json = JSON.parse(new TextDecoder().decode(files.get(`${source.file}.gltf`)!));
  const doc = await io.readJSON({ json, resources: {} } as JSONDocument);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const clips = keepGentleClips(doc, name, source);

  const body = root.listNodes().find((n) => n.getSkin() && n.getMesh())!;
  const mesh = body.getMesh()!;
  const prims = [...mesh.listPrimitives()];
  // Rigid parts parented to a joint (the stag's antlers) are skinned to it, then joined.
  for (const node of root.listNodes()) {
    const part = node.getMesh();
    if (!part || node === body) continue;
    const index = joints.indexOf(node.getParentNode()!);
    if (index < 0) throw new Error(`${name}: ${node.getName()} is neither skinned nor on a joint`);
    // Skinned: jointWorld × inverseBind × v; rigid child: jointWorld × local × v.
    const matrix = new Matrix4()
      .fromArray(skin.getInverseBindMatrices()!.getElement(index, []))
      .invert()
      .multiply(new Matrix4().fromArray(node.getMatrix()));
    for (const prim of part.listPrimitives()) {
      transformPrimitive(prim, matrix.toArray() as Parameters<typeof transformPrimitive>[1]);
      skinToJoint(doc, prim, index, prims[0]);
      prims.push(prim);
    }
    node.dispose();
  }
  const material = doc.createMaterial(name).setRoughnessFactor(1).setMetallicFactor(0);
  for (const prim of prims) {
    bakeColour(doc, prim);
    prim.setMaterial(material);
  }
  const joined = joinPrimitives(prims);
  for (const prim of mesh.listPrimitives()) mesh.removePrimitive(prim);
  mesh.addPrimitive(joined);

  const scene = root.listScenes()[0];
  scene.setName(name);
  // The loader makes names unique across the file: keep the scene name free for its animal.
  scene.listChildren()[0].setName(`${name}_rig`);
  body.setName(`${name}_body`);
  await doc.transform(prune(), resample({ tolerance: 2e-3 }), dedup(), weld());
  dropRestChannels(doc);
  await doc.transform(prune());

  const position = joined.getAttribute('POSITION')!;
  return {
    doc,
    info: {
      triangles: joined.getIndices()!.getCount() / 3,
      min: position.getMin([]),
      max: position.getMax([]),
      clips,
    },
  };
}

async function buildAnimals(io: NodeIO): Promise<void> {
  const files = loadAnimalPack();
  if (!files) {
    console.log(
      `Pack d'animaux absent (assets/${ANIMAL_ZIP_PREFIX}*.zip) : rien n'est généré, ` +
        'la scène utilisera les formes de remplacement.',
    );
    return;
  }
  const out = new Document();
  out.createBuffer();
  const manifest: string[] = [];
  let totalTriangles = 0;
  for (const [name, source] of Object.entries<AnimalSource>(ANIMAL_CATALOG)) {
    const { doc, info } = await prepareAnimal(io, files, name, source);
    mergeDocuments(out, doc);
    totalTriangles += info.triangles;
    const clips = ANIMAL_CLIPS.map((clip) => `${clip}: ${round(info.clips[clip])}`).join(', ');
    manifest.push(
      `  ${name}: { triangles: ${info.triangles}, ` +
        `min: [${info.min.map(round).join(', ')}], max: [${info.max.map(round).join(', ')}], ` +
        `clips: { ${clips} } },`,
    );
  }
  // One buffer for the whole file.
  const [buffer, ...others] = out.getRoot().listBuffers();
  for (const accessor of out.getRoot().listAccessors()) accessor.setBuffer(buffer);
  for (const other of others) other.dispose();
  await out.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const glb = await io.writeBinary(out);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, ANIMAL_FILE), glb);
  writeFileSync(
    ANIMAL_MANIFEST,
    `// Generated by \`npm run assets\` from the local Quaternius pack. Do not edit.
import type { AnimalClip, AnimalName } from './animal-catalog';

/** Optimised animals, relative to the site base. Absent without the pack. */
export const ANIMAL_FILE = 'assets/${ANIMAL_FILE}';

export interface AnimalInfo {
  triangles: number;
  /** Bounds in the bind pose, in model units. */
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  /** Duration of each clip, in seconds. */
  clips: Record<AnimalClip, number>;
}

export const ANIMALS = {
${manifest.join('\n')}
} as const satisfies Record<AnimalName, AnimalInfo>;
`,
  );
  console.log(
    `${manifest.length} animaux, ${totalTriangles} triangles, ` +
      `${(glb.byteLength / 1024).toFixed(0)} ko -> public/assets/${ANIMAL_FILE} ; manifeste src/scene/animals.gen.ts`,
  );
}

async function main(): Promise<void> {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await buildKayKit(io);
  await buildAnimals(io);
}

async function buildKayKit(io: NodeIO): Promise<void> {
  const packs: Record<Pack, Files | null> = { forest: loadPack('forest'), hex: loadPack('hex') };
  const missing = (Object.keys(packs) as Pack[]).filter((p) => !packs[p]);
  if (missing.length > 0) {
    console.log(
      `Packs absents (${missing.map((p) => `assets/${PACK_ZIPS[p]}`).join(', ')}) : rien n'est généré, ` +
        'la scène utilisera les formes de remplacement.',
    );
    return;
  }

  const atlas = buildAtlas(readTexture(packs.forest!, 'forest'), readTexture(packs.hex!, 'hex'));
  const png = new PNG({ width: ATLAS_SIZE, height: ATLAS_SIZE });
  png.data = Buffer.from(atlas);
  const atlasPng = PNG.sync.write(png, { colorType: 2, inputHasAlpha: true });

  const doc = new Document();
  const buffer = doc.createBuffer();
  const texture = doc
    .createTexture('atlas')
    .setImage(new Uint8Array(atlasPng))
    .setMimeType('image/png');
  const material = doc
    .createMaterial('atlas')
    .setBaseColorTexture(texture)
    .setRoughnessFactor(1)
    .setMetallicFactor(0);
  const scene = doc.createScene('models');

  const manifest: string[] = [];
  let totalTriangles = 0;
  for (const [name, source] of Object.entries<ModelSource>(CATALOG)) {
    let geometry = await readGeometry(io, packs[source.pack]!, source.file);
    if (source.leafPart !== undefined) {
      const parts = leafParts(geometry);
      if (source.leafPart >= parts.length)
        throw new Error(`${name}: no leaf part ${source.leafPart}`);
      geometry = parts[source.leafPart];
      recenter(geometry);
    }
    if (source.pack === 'hex') remapHexUvs(name, geometry);
    const b = bounds(geometry);
    const triangles = geometry.indices.length / 3;
    totalTriangles += triangles;
    manifest.push(
      `  ${name}: { kind: '${source.kind}', triangles: ${triangles}, ` +
        `min: [${b.min.map(round).join(', ')}], max: [${b.max.map(round).join(', ')}] },`,
    );
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(geometry.positions).setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(geometry.normals).setBuffer(buffer),
      )
      .setAttribute(
        'TEXCOORD_0',
        doc.createAccessor().setType('VEC2').setArray(geometry.uvs).setBuffer(buffer),
      )
      .setIndices(
        doc.createAccessor().setType('SCALAR').setArray(geometry.indices).setBuffer(buffer),
      );
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  }

  await doc.transform(
    weld(),
    dedup(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const glb = await io.writeBinary(doc);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, OUT_FILE), glb);

  writeFileSync(
    MANIFEST,
    `// Generated by \`npm run assets\` from the local KayKit packs. Do not edit.
import type { ModelKind, ModelName } from './asset-catalog';

/** Optimised models and atlas, relative to the site base. Absent without the packs. */
export const ASSET_FILE = 'assets/${OUT_FILE}';

export interface ModelInfo {
  kind: ModelKind;
  triangles: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export const MODELS = {
${manifest.join('\n')}
} as const satisfies Record<ModelName, ModelInfo>;
`,
  );
  console.log(
    `${Object.keys(CATALOG).length} modèles, ${totalTriangles} triangles, ` +
      `${(glb.byteLength / 1024).toFixed(0)} ko -> public/assets/${OUT_FILE} ; manifeste src/scene/assets.gen.ts`,
  );
}

await main();
