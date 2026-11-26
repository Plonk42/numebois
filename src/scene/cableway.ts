import { shadeOf, swatchUV, type SwatchName } from './atlas';
import { MeshWriter, type MeshData } from './mesh-data';
import { beam, facing, outward } from './props';
import type { Cableway } from './terrain/types';

/**
 * The mountain's cable car (#154): two ropes from a station beside the pool, over pylons on
 * the ledges, to a station under the summit of the great peak. A red cabin hangs on each and
 * they shuttle in turn, one going up while the other comes down, waiting a little in each
 * station. A function of the time only, like the herd.
 */

/** Half the gap between the two ropes, one cabin on each. */
export const GAUGE = 0.8;
/** From a rope down to the floor of its cabin. */
export const HANG = 2.4;
/** Ropes over the ground at the bottom station, a pylon (at least), the top station. */
export const ROPE_OVER = { bottom: 3.4, pylon: 7, top: 3 } as const;
/** Sag of a rope, as a share of its span. */
const SAG = 0.03;
const SAMPLES = 16;
/** Cabins' speed in units per second, and seconds they wait in a station. */
const SPEED = 2.4;
const WAIT = 4;

type Vec3 = [number, number, number];

/** How far a rope hangs under the straight line between its supports, at a share of its span. */
export function sagAt(span: number, t: number): number {
  return 4 * SAG * span * t * (1 - t);
}

/** Across the line, horizontally: the side of each rope. */
function across(c: Cableway): [number, number] {
  const a = c.supports[0];
  const b = c.supports[c.supports.length - 1];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return [-(b.z - a.z) / l, (b.x - a.x) / l];
}

/** Heading of the line from the bottom station up, for a model facing +z. */
export function headingOf(c: Cableway): number {
  const a = c.supports[0];
  const b = c.supports[c.supports.length - 1];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Points along a rope (side -1 or 1, 0 for the middle of the line), sagging between supports. */
export function ropePoints(c: Cableway, side: number): Vec3[] {
  const [ax, az] = across(c);
  const out: Vec3[] = [];
  for (let k = 0; k + 1 < c.supports.length; k++) {
    const a = c.supports[k];
    const b = c.supports[k + 1];
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    for (let i = k === 0 ? 0 : 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      out.push([
        a.x + (b.x - a.x) * t + ax * side * GAUGE,
        a.y + (b.y - a.y) * t - sagAt(span, t),
        a.z + (b.z - a.z) * t + az * side * GAUGE,
      ]);
    }
  }
  return out;
}

export interface CabinPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** A little swing along the line, after each start and stop. */
  swing: number;
}

/** Where cabin 0 or 1 hangs at a time: the point of its rope it runs on. */
export function cabinAt(c: Cableway, index: number, time: number): CabinPose {
  const rope = ropePoints(c, index === 0 ? -1 : 1);
  const lengths = [0];
  for (let i = 1; i < rope.length; i++) {
    const [a, b] = [rope[i - 1], rope[i]];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const length = lengths[lengths.length - 1];
  const trip = length / SPEED;
  const period = 2 * (trip + WAIT);
  // One leaves the bottom when the other leaves the top.
  const t = (((time + index * (trip + WAIT)) % period) + period) % period;
  const ease = (u: number) => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);
  let share: number;
  let since: number;
  if (t < trip) [share, since] = [ease(t / trip), t];
  else if (t < trip + WAIT) [share, since] = [1, t - trip];
  else if (t < 2 * trip + WAIT)
    [share, since] = [1 - ease((t - trip - WAIT) / trip), t - trip - WAIT];
  else [share, since] = [0, t - 2 * trip - WAIT];
  const at = share * length;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < at) i++;
  const u = (at - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  const [a, b] = [rope[i - 1], rope[i]];
  return {
    x: a[0] + (b[0] - a[0]) * u,
    y: a[1] + (b[1] - a[1]) * u,
    z: a[2] + (b[2] - a[2]) * u,
    yaw: headingOf(c),
    swing: 0.06 * Math.exp(-since / 1.5) * Math.sin(since * 3.4),
  };
}

/** A frame on the ground: a point and a heading; local +z along the heading. */
interface Frame {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

function place(f: Frame, [lx, ly, lz]: readonly number[]): Vec3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [f.x + lx * c + lz * s, f.y + ly, f.z - lx * s + lz * c];
}

/** A box in a frame, from its centre and half sizes, each face shaded by its slope. */
function block(
  out: MeshWriter,
  f: Frame,
  [cx, cy, cz]: readonly number[],
  [hx, hy, hz]: readonly number[],
  swatch: SwatchName,
  sides: SwatchName = swatch,
): void {
  const p = (i: number, j: number, k: number) => place(f, [cx + i * hx, cy + j * hy, cz + k * hz]);
  const faces: [Vec3[], number[], SwatchName][] = [
    [[p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)], [0, 1, 0], swatch],
    [[p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)], [0, -1, 0], sides],
    [[p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)], [1, 0, 0], sides],
    [[p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1)], [-1, 0, 0], sides],
    [[p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], [0, 0, 1], sides],
    [[p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1)], [0, 0, -1], sides],
  ];
  for (const [quad, n, name] of faces) {
    const world = place({ ...f, x: 0, y: 0, z: 0 }, n);
    outward(out, quad, world, swatchUV(name, shadeOf(world[1])));
  }
}

/** A gable roof over a box of half sizes hx, hz, from height y0 up to its ridge along z. */
function roof(
  out: MeshWriter,
  f: Frame,
  [cx, y0, cz]: readonly number[],
  hx: number,
  hz: number,
  rise: number,
) {
  const p = (x: number, y: number, z: number) => place(f, [cx + x, y0 + y, cz + z]);
  for (const side of [-1, 1]) {
    const n = place({ ...f, x: 0, y: 0, z: 0 }, [side * rise, hx, 0]);
    outward(
      out,
      [p(side * hx, 0, -hz), p(side * hx, 0, hz), p(0, rise, hz), p(0, rise, -hz)],
      n,
      swatchUV('PetalRed', shadeOf(n[1] / Math.hypot(...n))),
    );
  }
  // Gables, a little inside the roof.
  for (const end of [-1, 1]) {
    const k = 0.92;
    facing(
      out,
      [p(-hx * k, 0, end * hz * k), p(hx * k, 0, end * hz * k), p(0, rise * k, end * hz * k)],
      place({ ...f, x: 0, y: 0, z: 0 }, [0, 0, end]),
      swatchUV('Cream', shadeOf(0)),
    );
  }
}

/**
 * A station: a bay under a roof where the cabins stop, over the ropes' end, and a little
 * house beside it, away from the line (`back` -1 at the bottom, 1 at the top). A stone
 * base reaches `deep` under the platform, into the slope.
 */
function station(out: MeshWriter, f: Frame, back: number, deep: number): void {
  const top = ROPE_OVER.bottom;
  block(out, f, [0, -deep / 2 + 0.2, back * 1.1], [2.2, deep / 2 + 0.2, 2.6], 'Stone');
  // The bay: four posts and a flat roof over the cabins, the bullwheel under it.
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      beam(
        out,
        place(f, [x * 1.9, 0.4, z * 1.1]),
        place(f, [x * 1.9, top + 0.9, z * 1.1]),
        0.18,
        0.18,
        'DarkBark',
      );
    }
  }
  block(out, f, [0, top + 1, 0], [2.15, 0.14, 1.35], 'DarkBark');
  block(out, f, [0, top + 0.25, 0], [GAUGE + 0.25, 0.1, GAUGE + 0.25], 'Stone');
  // The house: cream walls, windows, a red roof.
  block(out, f, [0, 1.6, back * 2.4], [1.8, 1.2, 1.2], 'Cream');
  for (const x of [-1, 1]) {
    block(out, f, [x * 1.81, 1.8, back * 2.4], [0.02, 0.35, 0.5], 'HexWater');
  }
  roof(out, f, [0, 2.8, back * 2.4], 2.05, 1.4, 1.1);
}

/** A pylon: four legs leaning in to a cross-arm carrying both ropes. */
function pylon(out: MeshWriter, f: Frame, height: number): void {
  const top = height - 0.25;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      beam(
        out,
        place(f, [x * 0.75, -0.6, z * 0.75]),
        place(f, [x * 0.28, top, z * 0.28]),
        0.16,
        0.16,
        'Stone',
      );
    }
  }
  for (const level of [0.3, 0.6]) {
    const h = top * level;
    const r = 0.75 + (0.28 - 0.75) * ((h + 0.6) / (top + 0.6));
    for (const z of [-1, 1]) {
      beam(out, place(f, [-r, h, z * r]), place(f, [r, h, z * r]), 0.1, 0.1, 'Stone');
      beam(out, place(f, [z * r, h, -r]), place(f, [z * r, h, r]), 0.1, 0.1, 'Stone');
    }
  }
  beam(
    out,
    place(f, [-(GAUGE + 0.35), top, 0]),
    place(f, [GAUGE + 0.35, top, 0]),
    0.22,
    0.22,
    'Stone',
  );
  for (const x of [-1, 1])
    block(out, f, [x * GAUGE, top + 0.18, 0], [0.12, 0.08, 0.35], 'DarkBark');
}

/** The stations, the pylons and the two ropes, in one mesh. */
export function cablewayMesh(c: Cableway): MeshData {
  const out = new MeshWriter(2048, 4096);
  const yaw = headingOf(c);
  const s = c.supports;
  s.forEach((support, i) => {
    const f = { x: support.x, y: support.ground, z: support.z, yaw };
    if (i === 0) station(out, f, -1, 1.5);
    // High on the peak, on a stone buttress into its steep slope.
    else if (i === s.length - 1) station(out, { ...f, y: support.y - ROPE_OVER.bottom }, 1, 4);
    else pylon(out, f, support.y - support.ground);
  });
  for (const side of [-1, 1]) {
    const rope = ropePoints(c, side);
    for (let i = 1; i < rope.length; i++) beam(out, rope[i - 1], rope[i], 0.07, 0.07, 'DarkBark');
  }
  return out.toMeshData();
}

/** A red cabin hanging from its rope: the carriage on the rope at the origin, facing +z. */
export function cabin(): MeshData {
  const out = new MeshWriter(256, 512);
  const f = { x: 0, y: 0, z: 0, yaw: 0 };
  block(out, f, [0, -0.05, 0], [0.12, 0.1, 0.45], 'DarkBark');
  beam(out, [0, -0.1, 0], [0, -0.75, 0], 0.1, 0.1, 'DarkBark');
  const floor = -HANG;
  const height = HANG - 0.8;
  // Body below the windows, the windows, a white roof.
  block(out, f, [0, floor + 0.35, 0], [0.7, 0.35, 0.85], 'PetalRed');
  block(
    out,
    f,
    [0, floor + 0.7 + (height - 1.05) / 2, 0],
    [0.68, (height - 1.05) / 2, 0.83],
    'HexWater',
  );
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      block(
        out,
        f,
        [x * 0.64, floor + 0.7 + (height - 1.05) / 2, z * 0.79],
        [0.07, (height - 1.05) / 2, 0.07],
        'PetalRed',
      );
    }
  }
  block(out, f, [0, floor + height - 0.175, 0], [0.74, 0.175, 0.89], 'Cream', 'PetalRed');
  return out.toMeshData();
}
