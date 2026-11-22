import { shadeOf, swatchUV, type SwatchName } from './atlas';
import { MeshWriter, type MeshData } from './mesh-data';

/**
 * Flowers and mushrooms missing from the free KayKit pack, generated in the same style:
 * a few smooth low-poly shapes coloured by the shared gradient atlas.
 * Petals and caps are mapped on the first accent cell; each instance shifts them to its
 * own colour column. Stems use the leaf row, centres and dots use unshifted cells.
 */

const TAU = Math.PI * 2;

/** Surface of revolution around Y. Profile points are [radius, height], bottom to top. */
function lathe(
  out: MeshWriter,
  profile: readonly (readonly [number, number])[],
  sides: number,
  swatch: SwatchName,
  cx = 0,
  cz = 0,
  shade: (normalY: number, t: number) => number = (ny) => shadeOf(ny),
): void {
  const rings: number[][] = [];
  profile.forEach(([r, y], k) => {
    const prev = profile[Math.max(0, k - 1)];
    const next = profile[Math.min(profile.length - 1, k + 1)];
    // Profile normal (rotated tangent).
    let ny = -(next[0] - prev[0]);
    let nr = next[1] - prev[1];
    const nl = Math.hypot(ny, nr) || 1;
    ny /= nl;
    nr /= nl;
    const t = k / (profile.length - 1);
    if (r < 1e-5) {
      const up = k === 0 ? -1 : 1;
      const [u, v] = swatchUV(swatch, shade(up, t));
      rings.push([out.vertex(cx, y, cz, 0, up, 0, u, v)]);
      return;
    }
    const ring: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const [u, v] = swatchUV(swatch, shade(ny, t));
      ring.push(
        out.vertex(
          cx + Math.cos(a) * r,
          y,
          cz + Math.sin(a) * r,
          Math.cos(a) * nr,
          ny,
          Math.sin(a) * nr,
          u,
          v,
        ),
      );
    }
    rings.push(ring);
  });
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (a.length === 1 && b.length > 1) out.triangle(a[0], b[i], b[j]);
      else if (b.length === 1 && a.length > 1) out.triangle(a[i], b[0], a[j]);
      else if (a.length > 1 && b.length > 1) {
        out.triangle(a[i], b[j], a[j]);
        out.triangle(a[i], b[i], b[j]);
      }
    }
  }
}

/** Flat two-sided kite (petal or leaf) from a base point towards a tip. */
function kite(
  out: MeshWriter,
  base: readonly number[],
  tip: readonly number[],
  width: number,
  swatch: SwatchName,
  baseShade: number,
  tipShade: number,
): void {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const dz = tip[2] - base[2];
  // Side direction: horizontal, perpendicular to the petal.
  let sx = -dz;
  let sz = dx;
  const sl = Math.hypot(sx, sz) || 1;
  sx = (sx / sl) * width * 0.5;
  sz = (sz / sl) * width * 0.5;
  const mx = base[0] + dx * 0.55;
  const my = base[1] + dy * 0.55;
  const mz = base[2] + dz * 0.55;
  // Normal: perpendicular to the petal plane, facing up.
  let nx = dy * sz;
  let ny = dz * sx - dx * sz;
  let nz = -dy * sx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const b = swatchUV(swatch, baseShade);
  const m = swatchUV(swatch, (baseShade + tipShade) / 2);
  const t = swatchUV(swatch, tipShade);
  for (const s of [1, -1]) {
    const i0 = out.vertex(base[0], base[1], base[2], nx * s, ny * s, nz * s, b[0], b[1]);
    const i1 = out.vertex(mx + sx, my, mz + sz, nx * s, ny * s, nz * s, m[0], m[1]);
    const i2 = out.vertex(tip[0], tip[1], tip[2], nx * s, ny * s, nz * s, t[0], t[1]);
    const i3 = out.vertex(mx - sx, my, mz - sz, nx * s, ny * s, nz * s, m[0], m[1]);
    // Geometric normal of (base, right, tip) decides the winding of the upper side.
    const gy = (mz + sz - base[2]) * dx - (mx + sx - base[0]) * dz;
    const up = gy * ny > 0;
    if (up === (s === 1)) {
      out.triangle(i0, i1, i2);
      out.triangle(i0, i2, i3);
    } else {
      out.triangle(i0, i2, i1);
      out.triangle(i0, i3, i2);
    }
  }
}

function stem(out: MeshWriter, height: number, radius: number, lean = 0): void {
  lathe(
    out,
    [
      [radius, 0],
      [radius * 0.8, height],
    ],
    3,
    'Summer',
    0,
    0,
    () => 0.5,
  );
  // The lathe is vertical: lean the top ring by moving its vertices.
  if (lean !== 0) {
    for (let i = out.vertexCount - 3; i < out.vertexCount; i++) out.positions[i * 3] += lean;
  }
}

/** Daisy: stem, a crown of petals and a yellow heart. */
export function daisy(): MeshData {
  const out = new MeshWriter(96, 192);
  const h = 0.42;
  stem(out, h, 0.016);
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    kite(
      out,
      [Math.cos(a) * 0.02, h, Math.sin(a) * 0.02],
      [Math.cos(a) * 0.15, h + 0.035, Math.sin(a) * 0.15],
      0.095,
      'PetalWhite',
      0.75,
      0.1,
    );
  }
  lathe(
    out,
    [
      [0.045, h + 0.005],
      [0.03, h + 0.04],
      [0, h + 0.05],
    ],
    5,
    'DryGrass',
    0,
    0,
    (ny) => 0.05 + (1 - ny) * 0.3,
  );
  kite(out, [0, 0.03, 0], [0.13, 0.14, 0.05], 0.07, 'Summer', 0.6, 0.25);
  return out.toMeshData();
}

/** Tulip: stem, two leaves and a closed cup. */
export function tulip(): MeshData {
  const out = new MeshWriter(96, 192);
  const h = 0.4;
  stem(out, h, 0.018, 0.02);
  lathe(
    out,
    [
      [0, h - 0.01],
      [0.06, h + 0.04],
      [0.075, h + 0.11],
      [0.05, h + 0.17],
      [0, h + 0.19],
    ],
    5,
    'PetalWhite',
    0.02,
    0,
    (_ny, t) => 0.85 - t * 0.75,
  );
  kite(out, [0, 0.02, 0], [0.12, 0.24, 0.04], 0.075, 'Summer', 0.65, 0.25);
  kite(out, [0, 0.02, 0], [-0.1, 0.2, -0.06], 0.07, 'Summer', 0.65, 0.3);
  return out.toMeshData();
}

/** Bellflower: a stem carrying a spike of small buds. */
export function bellflower(): MeshData {
  const out = new MeshWriter(128, 256);
  const h = 0.55;
  stem(out, h, 0.016);
  for (let i = 0; i < 4; i++) {
    const y = h * (0.52 + 0.14 * i);
    const a = i * 2.4;
    const r = 0.055 - i * 0.006;
    lathe(
      out,
      [
        [0, y - r],
        [r, y],
        [0, y + r * 1.25],
      ],
      4,
      'PetalWhite',
      Math.cos(a) * 0.035,
      Math.sin(a) * 0.035,
      (ny) => 0.15 + (1 - ny) * 0.35,
    );
  }
  kite(out, [0, 0.02, 0], [0.1, 0.2, -0.05], 0.065, 'Summer', 0.65, 0.3);
  return out.toMeshData();
}

function mushroomAt(out: MeshWriter, cx: number, cz: number, size: number, dots: boolean): void {
  const h = 0.3 * size;
  const r = 0.2 * size;
  lathe(
    out,
    [
      [0.07 * size, 0],
      [0.05 * size, h * 0.75],
    ],
    5,
    'Birch',
    cx,
    cz,
    () => 0.45,
  );
  lathe(
    out,
    [
      [r * 0.55, h * 0.62],
      [r, h * 0.7],
      [r * 0.72, h * 1.05],
      [0, h * 1.25],
    ],
    7,
    'PetalWhite',
    cx,
    cz,
    (_ny, t) => 0.9 - t * 0.8,
  );
  if (!dots) return;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.4;
    const d = r * (i === 0 ? 0.1 : 0.55);
    const y = h * (i === 0 ? 1.23 : 1.02);
    lathe(
      out,
      [
        [0.035 * size, y],
        [0, y + 0.035 * size],
      ],
      4,
      'Birch',
      cx + Math.cos(a) * d,
      cz + Math.sin(a) * d,
      () => 0.05,
    );
  }
}

/** Toadstool with white dots. */
export function toadstool(): MeshData {
  const out = new MeshWriter(128, 256);
  mushroomAt(out, 0, 0, 1, true);
  return out.toMeshData();
}

/** Clump of three small mushrooms. */
export function mushroomClump(): MeshData {
  const out = new MeshWriter(128, 256);
  mushroomAt(out, 0, 0, 0.75, false);
  mushroomAt(out, 0.16, 0.06, 0.5, false);
  mushroomAt(out, -0.07, 0.15, 0.4, false);
  return out.toMeshData();
}

export const GENERATED_PROPS = {
  'gen:daisy': daisy,
  'gen:tulip': tulip,
  'gen:bellflower': bellflower,
  'gen:toadstool': toadstool,
  'gen:mushrooms': mushroomClump,
} as const;
