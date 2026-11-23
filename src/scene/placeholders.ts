import { CATALOG, type ModelName } from './asset-catalog';
import { MODELS } from './assets.gen';
import { shadeOf, swatchUV, type SwatchName } from './atlas';
import { MeshWriter, type MeshData } from './mesh-data';

/**
 * Stand-in shapes with the size of the real models, for a clone without the KayKit packs
 * (CI, fresh checkout). They follow the same atlas conventions as the real models.
 */
export function placeholderModel(name: ModelName): MeshData {
  const info = MODELS[name];
  const min = info.min;
  const max = info.max;
  switch (info.kind) {
    case 'tuft':
    case 'bush':
      return ellipsoid(min, max, 'Summer', true);
    case 'cloud':
      return ellipsoid(min, max, 'HexCloud', true);
    case 'rock':
      return ellipsoid(min, max, 'Stone', false);
    case 'log':
    case 'stump':
      return ellipsoid(min, max, 'Bark', false);
    case 'building':
      return ellipsoid(min, max, 'Cream', false);
    case 'mountain':
      return ellipsoid([min[0], min[1] - (max[1] - min[1]), min[2]], max, 'HexStone', false);
    case 'waterplant':
      return ellipsoid(min, max, 'HexLily', false);
    case 'lily':
      return disc(min, max, 'HexLily');
    case 'grass':
      return blades(min, max);
  }
}

// Icosahedron (12 vertices, 20 faces), subdivided once for smooth shapes.
const T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTICES = [
  [-1, T, 0],
  [1, T, 0],
  [-1, -T, 0],
  [1, -T, 0],
  [0, -1, T],
  [0, 1, T],
  [0, -1, -T],
  [0, 1, -T],
  [T, 0, -1],
  [T, 0, 1],
  [-T, 0, -1],
  [-T, 0, 1],
].map((v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
});
const ICO_FACES = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

function ellipsoid(
  min: readonly number[],
  max: readonly number[],
  swatch: SwatchName,
  smooth: boolean,
): MeshData {
  const center = [0, 1, 2].map((a) => (min[a] + max[a]) / 2);
  const half = [0, 1, 2].map((a) => Math.max(1e-3, (max[a] - min[a]) / 2));
  const out = new MeshWriter(64, 256);
  const place = (p: readonly number[]) => [
    center[0] + p[0] * half[0],
    center[1] + p[1] * half[1],
    center[2] + p[2] * half[2],
  ];
  if (!smooth) {
    for (const f of ICO_FACES) {
      const a = place(ICO_VERTICES[f[0]]);
      const b = place(ICO_VERTICES[f[1]]);
      const c = place(ICO_VERTICES[f[2]]);
      const ny = (ICO_VERTICES[f[0]][1] + ICO_VERTICES[f[1]][1] + ICO_VERTICES[f[2]][1]) / 3;
      out.facet(a, b, c, swatchUV(swatch, shadeOf(ny)));
    }
    return out.toMeshData();
  }
  const points = ICO_VERTICES.map((v) => [...v]);
  const mid = new Map<string, number>();
  const midpoint = (i: number, j: number): number => {
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    let m = mid.get(key);
    if (m === undefined) {
      const p = [0, 1, 2].map((a) => points[i][a] + points[j][a]);
      const l = Math.hypot(p[0], p[1], p[2]);
      m = points.push([p[0] / l, p[1] / l, p[2] / l]) - 1;
      mid.set(key, m);
    }
    return m;
  };
  const faces: number[][] = [];
  for (const [a, b, c] of ICO_FACES) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  for (const p of points) {
    const q = place(p);
    const n = [p[0] / half[0], p[1] / half[1], p[2] / half[2]];
    const l = Math.hypot(n[0], n[1], n[2]);
    const [u, v] = swatchUV(swatch, shadeOf(n[1] / l));
    out.vertex(q[0], q[1], q[2], n[0] / l, n[1] / l, n[2] / l, u, v);
  }
  for (const f of faces) out.triangle(f[0], f[1], f[2]);
  return out.toMeshData();
}

function disc(min: readonly number[], max: readonly number[], swatch: SwatchName): MeshData {
  const out = new MeshWriter(32, 64);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const rx = (max[0] - min[0]) / 2;
  const rz = (max[2] - min[2]) / 2;
  const uv = swatchUV(swatch, 0.2);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    out.facet(
      [cx, max[1], cz],
      [cx + Math.cos(a1) * rx, max[1], cz + Math.sin(a1) * rz],
      [cx + Math.cos(a0) * rx, max[1], cz + Math.sin(a0) * rz],
      uv,
    );
  }
  return out.toMeshData();
}

function blades(min: readonly number[], max: readonly number[]): MeshData {
  const out = new MeshWriter(32, 64);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const rx = (max[0] - min[0]) / 2;
  const rz = (max[2] - min[2]) / 2;
  const count = Math.max(rx, rz) > 0.25 ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const bx = cx + Math.cos(a) * rx * 0.4;
    const bz = cz + Math.sin(a) * rz * 0.4;
    const w = Math.max(0.03, Math.min(rx, rz) * 0.3);
    const sx = -Math.sin(a) * w;
    const sz = Math.cos(a) * w;
    const tip = [
      cx + Math.cos(a) * rx * 0.95,
      max[1] * (0.7 + 0.3 * ((i * 7) % 3) * 0.5),
      cz + Math.sin(a) * rz * 0.95,
    ];
    const left = [bx - sx, 0, bz - sz];
    const right = [bx + sx, 0, bz + sz];
    const n = [Math.cos(a) * 0.4, 0.9, Math.sin(a) * 0.4];
    const base = swatchUV('Summer', 0.55);
    const top = swatchUV('Summer', 0.12);
    // Two-sided blade: the same triangle with both windings.
    for (const flip of [false, true]) {
      const s = flip ? -1 : 1;
      const i0 = out.vertex(left[0], left[1], left[2], n[0] * s, n[1], n[2] * s, base[0], base[1]);
      const i1 = out.vertex(
        right[0],
        right[1],
        right[2],
        n[0] * s,
        n[1],
        n[2] * s,
        base[0],
        base[1],
      );
      const i2 = out.vertex(tip[0], tip[1], tip[2], n[0] * s, n[1], n[2] * s, top[0], top[1]);
      if (flip) out.triangle(i0, i2, i1);
      else out.triangle(i0, i1, i2);
    }
  }
  return out.toMeshData();
}

/** Every catalogued model as a placeholder. */
export function placeholderModels(): Map<ModelName, MeshData> {
  const models = new Map<ModelName, MeshData>();
  for (const name of Object.keys(CATALOG) as ModelName[]) models.set(name, placeholderModel(name));
  return models;
}
