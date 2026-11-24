import { shadeOf, swatchUV, type SwatchName } from '../atlas';
import type { MeshWriter } from '../mesh-data';
import { lathe, outward } from '../props';

/**
 * Wooden pieces of the great tree (#92), generated in the KayKit style: plank decks around
 * the trunk, railings, ladders, a spiral stair, Plume's cabin, a swing, nesting boxes,
 * a flag and paper lanterns. All flat-shaded boxes and lathes coloured by the atlas.
 */

const TAU = Math.PI * 2;

export type P3 = readonly [number, number, number];

/**
 * Box around a centre, along three unit axes (u across, v up, w along) with half sizes.
 * Each face takes the shade of its normal.
 */
export function box(
  out: MeshWriter,
  c: P3,
  u: P3,
  v: P3,
  w: P3,
  hu: number,
  hv: number,
  hw: number,
  swatch: SwatchName,
  light = 0,
): void {
  const at = (i: number, j: number, k: number): P3 => [
    c[0] + u[0] * hu * i + v[0] * hv * j + w[0] * hw * k,
    c[1] + u[1] * hu * i + v[1] * hv * j + w[1] * hw * k,
    c[2] + u[2] * hu * i + v[2] * hv * j + w[2] * hw * k,
  ];
  const faces: readonly [P3, P3[]][] = [
    [u, [at(1, -1, -1), at(1, 1, -1), at(1, 1, 1), at(1, -1, 1)]],
    [
      [-u[0], -u[1], -u[2]],
      [at(-1, -1, -1), at(-1, -1, 1), at(-1, 1, 1), at(-1, 1, -1)],
    ],
    [v, [at(-1, 1, -1), at(-1, 1, 1), at(1, 1, 1), at(1, 1, -1)]],
    [
      [-v[0], -v[1], -v[2]],
      [at(-1, -1, -1), at(1, -1, -1), at(1, -1, 1), at(-1, -1, 1)],
    ],
    [w, [at(-1, -1, 1), at(1, -1, 1), at(1, 1, 1), at(-1, 1, 1)]],
    [
      [-w[0], -w[1], -w[2]],
      [at(-1, -1, -1), at(-1, 1, -1), at(1, 1, -1), at(1, -1, -1)],
    ],
  ];
  for (const [n, quad] of faces) {
    const shade = Math.min(0.95, Math.max(0.02, shadeOf(n[1]) * (1 - light) + 0.02));
    outward(out, quad, n, swatchUV(swatch, shade));
  }
}

function sub(a: P3, b: P3): P3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function unit(a: P3): P3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function cross(a: P3, b: P3): P3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Square stick from a to b (post, rail, rope, rung). */
export function stick(
  out: MeshWriter,
  a: P3,
  b: P3,
  width: number,
  swatch: SwatchName,
  light = 0,
): void {
  const d = sub(b, a);
  const length = Math.hypot(d[0], d[1], d[2]);
  const w = unit(d);
  const across: P3 = Math.abs(w[1]) > 0.95 ? [1, 0, 0] : unit(cross(w, [0, 1, 0]));
  const up = unit(cross(across, w));
  const c: P3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  box(out, c, across, up, w, width / 2, width / 2, length / 2, swatch, light);
}

/** Point at an angle and a distance around the axis of the trunk, at a height. */
function around(cx: number, cz: number, y: number, angle: number, radius: number): P3 {
  return [cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius];
}

/**
 * Plank deck around the trunk, its top at `y`, with braces under it: a full ring, or the arc
 * from `from` to `to` (angles in the ground plane, `from` < `to`).
 */
export function deck(
  out: MeshWriter,
  cx: number,
  cz: number,
  y: number,
  inner: number,
  outer: number,
  from = 0,
  to = TAU,
): void {
  const span = to - from;
  const planks = Math.max(4, Math.round((outer * 5 * span) / TAU));
  const thick = 0.2;
  for (let i = 0; i < planks; i++) {
    const a0 = from + (i / planks) * span;
    const a1 = from + ((i + 1) / planks) * span;
    const am = (a0 + a1) / 2;
    // Plank by plank, a little lighter or darker.
    const tone = i % 3 === 0 ? 0.32 : i % 3 === 1 ? 0.22 : 0.27;
    const top = swatchUV('Brown', tone);
    outward(
      out,
      [
        around(cx, cz, y, a0, inner),
        around(cx, cz, y, a0, outer),
        around(cx, cz, y, a1, outer),
        around(cx, cz, y, a1, inner),
      ],
      [0, 1, 0],
      top,
    );
    outward(
      out,
      [
        around(cx, cz, y, a0, outer),
        around(cx, cz, y - thick, a0, outer),
        around(cx, cz, y - thick, a1, outer),
        around(cx, cz, y, a1, outer),
      ],
      [Math.cos(am), 0, Math.sin(am)],
      swatchUV('Brown', 0.55),
    );
    outward(
      out,
      [
        around(cx, cz, y - thick, a0, inner),
        around(cx, cz, y - thick, a1, inner),
        around(cx, cz, y - thick, a1, outer),
        around(cx, cz, y - thick, a0, outer),
      ],
      [0, -1, 0],
      swatchUV('Brown', 0.8),
    );
  }
  // Braces from the trunk to the rim.
  const braces = Math.max(2, Math.round((4 * span) / TAU));
  for (let i = 0; i < braces; i++) {
    const a = span < TAU ? from + ((i + 0.5) / braces) * span : (i / braces) * TAU + 0.4;
    stick(
      out,
      around(cx, cz, y - Math.min(1.6, outer * 0.8), a, inner * 0.8),
      around(cx, cz, y - thick, a, outer * 0.85),
      0.16,
      'DarkBark',
    );
  }
}

/**
 * Railing on the rim of a deck: posts and two rails, open where `gap` says so; on an arc,
 * from `from` to `to`, with its two ends closed.
 */
export function railing(
  out: MeshWriter,
  cx: number,
  cz: number,
  y: number,
  radius: number,
  gap: (angle: number) => boolean,
  from = 0,
  to = TAU,
): void {
  const span = to - from;
  const closed = span >= TAU - 1e-6;
  const posts = Math.max(closed ? 8 : 3, Math.round((radius * 3.2 * span) / TAU));
  const height = 0.7;
  for (let i = 0; i < (closed ? posts : posts + 1); i++) {
    const a0 = from + (i / posts) * span;
    const a1 = from + ((i + 1) / posts) * span;
    if (gap(a0)) continue;
    stick(out, around(cx, cz, y, a0, radius), around(cx, cz, y + height, a0, radius), 0.1, 'Brown');
    if (gap(a1) || (!closed && i === posts)) continue;
    for (const h of [height - 0.04, height * 0.5]) {
      stick(
        out,
        around(cx, cz, y + h, a0, radius),
        around(cx, cz, y + h, a1, radius),
        0.07,
        'Brown',
        0.2,
      );
    }
  }
}

/** Ladder from its foot to its top: two rails and a rung every 0.35. */
export function ladder(out: MeshWriter, foot: P3, top: P3, width = 0.6): void {
  const d = sub(top, foot);
  const across = unit(cross(d, [0, 1, 0]));
  const side = (p: P3, s: number): P3 => [
    p[0] + across[0] * s * width * 0.5,
    p[1],
    p[2] + across[2] * s * width * 0.5,
  ];
  stick(out, side(foot, 1), side(top, 1), 0.09, 'Brown');
  stick(out, side(foot, -1), side(top, -1), 0.09, 'Brown');
  const length = Math.hypot(d[0], d[1], d[2]);
  const rungs = Math.max(2, Math.floor(length / 0.35));
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const p: P3 = [foot[0] + d[0] * t, foot[1] + d[1] * t, foot[2] + d[2] * t];
    stick(out, side(p, 1.05), side(p, -1.05), 0.07, 'Brown', 0.25);
  }
}

/**
 * Spiral stair around the trunk from one height to another: planks set into the bark,
 * turning from `angle`; `radius` gives the bark radius at a height.
 */
export function spiralStair(
  out: MeshWriter,
  axis: (y: number) => { x: number; z: number; r: number },
  from: number,
  to: number,
  angle: number,
  turn: number,
): void {
  const steps = Math.max(4, Math.round((to - from) / 0.32));
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const y = from + (to - from) * t;
    const a = angle + turn * t;
    const { x, z, r } = axis(y);
    const step = 1.0;
    stick(out, around(x, z, y, a, r * 0.85), around(x, z, y, a, r + step), 0.42, 'Brown', 0.15);
  }
}

/**
 * Plume's cabin: round plank walls, a red cone roof, a door and a lit window, `size` wide.
 * Its door faces `facing` (angle in the ground plane).
 */
export function cabin(
  out: MeshWriter,
  foot: P3,
  facing: number,
  size: number,
  roof: SwatchName = 'PetalRed',
): void {
  const r = size / 2;
  const h = size * 0.85;
  const [x, y, z] = foot;
  lathe(
    out,
    [
      [r, y],
      [r * 1.02, y + h * 0.5],
      [r, y + h],
    ],
    8,
    'Cream',
    x,
    z,
    (ny) => 0.3 + (1 - ny) * 0.2,
  );
  lathe(
    out,
    [
      [r * 1.3, y + h - 0.05],
      [r * 1.15, y + h + size * 0.12],
      [r * 0.55, y + h + size * 0.55],
      [0, y + h + size * 0.82],
    ],
    8,
    roof,
    x,
    z,
    (ny) => 0.15 + (1 - ny) * 0.55,
  );
  const f: P3 = [Math.cos(facing), 0, Math.sin(facing)];
  const s: P3 = [-f[2], 0, f[0]];
  const wall = (along: number, height: number, depth = r * 0.98): P3 => [
    x + f[0] * depth + s[0] * along,
    y + height,
    z + f[2] * depth + s[2] * along,
  ];
  // A round-topped door, a window lit from inside, a little chimney.
  box(out, wall(-r * 0.2, h * 0.33), s, [0, 1, 0], f, size * 0.15, h * 0.33, 0.05, 'DarkBark');
  box(
    out,
    wall(r * 0.45, h * 0.55),
    s,
    [0, 1, 0],
    f,
    size * 0.1,
    size * 0.1,
    0.05,
    'PetalYellow',
    1,
  );
  stick(
    out,
    [x - f[0] * r * 0.3 + s[0] * r * 0.4, y + h + size * 0.2, z - f[2] * r * 0.3 + s[2] * r * 0.4],
    [x - f[0] * r * 0.3 + s[0] * r * 0.4, y + h + size * 0.62, z - f[2] * r * 0.3 + s[2] * r * 0.4],
    size * 0.12,
    'Stone',
  );
}

/** Swing hanging from a branch: two ropes and a plank seat, facing `facing`. */
export function swing(out: MeshWriter, branch: P3, seatY: number, facing: number): void {
  const s: P3 = [-Math.sin(facing), 0, Math.cos(facing)];
  const half = 0.4;
  for (const k of [1, -1]) {
    stick(
      out,
      [branch[0] + s[0] * half * k, branch[1], branch[2] + s[2] * half * k],
      [branch[0] + s[0] * half * k, seatY, branch[2] + s[2] * half * k],
      0.05,
      'Cream',
      0.3,
    );
  }
  box(
    out,
    [branch[0], seatY, branch[2]],
    s,
    [0, 1, 0],
    [Math.cos(facing), 0, Math.sin(facing)],
    half + 0.12,
    0.06,
    0.2,
    'Brown',
  );
}

/** Nesting box on the bark, its hole facing out along `facing`. */
export function nestingBox(out: MeshWriter, at: P3, facing: number, roof: SwatchName): void {
  const f: P3 = [Math.cos(facing), 0, Math.sin(facing)];
  const s: P3 = [-f[2], 0, f[0]];
  box(out, at, s, [0, 1, 0], f, 0.33, 0.4, 0.3, 'Brown', 0.2);
  lathe(
    out,
    [
      [0.55, at[1] + 0.36],
      [0, at[1] + 0.75],
    ],
    4,
    roof,
    at[0],
    at[2],
    (ny) => 0.2 + (1 - ny) * 0.5,
  );
  box(
    out,
    [at[0] + f[0] * 0.3, at[1] + 0.08, at[2] + f[2] * 0.3],
    s,
    [0, 1, 0],
    f,
    0.1,
    0.1,
    0.02,
    'DarkBark',
  );
}

/** Flag on a pole, from its foot. */
export function flag(out: MeshWriter, foot: P3, height: number, facing: number): void {
  const top: P3 = [foot[0], foot[1] + height, foot[2]];
  stick(out, foot, top, 0.08, 'DarkBark');
  const s: P3 = [-Math.sin(facing), 0, Math.cos(facing)];
  const tip: P3 = [top[0] + s[0] * 1.1, top[1] - 0.3, top[2] + s[2] * 1.1];
  const low: P3 = [top[0], top[1] - 0.6, top[2]];
  // Both sides of the cloth.
  out.facet(top, tip, low, swatchUV('PetalYellow', 0.3));
  out.facet(top, low, tip, swatchUV('PetalYellow', 0.5));
}

/** Paper lantern hanging from a string, its body centred at `at`. */
export function lantern(out: MeshWriter, at: P3, colour: SwatchName): void {
  const [x, y, z] = at;
  lathe(
    out,
    [
      [0, y - 0.22],
      [0.15, y - 0.16],
      [0.19, y],
      [0.15, y + 0.16],
      [0, y + 0.22],
    ],
    6,
    colour,
    x,
    z,
    () => 0.08,
  );
}

/** Points of a garland sagging between two points, `count` of them, ends excluded. */
export function garland(a: P3, b: P3, count: number, sag: number): P3[] {
  const points: P3[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    points.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t),
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  return points;
}
