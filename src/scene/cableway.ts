import { shadeOf, swatchUV, type SwatchName } from './atlas';
import { MeshWriter, type MeshData } from './mesh-data';
import { beam, facing, outward } from './props';
import type { Cableway } from './terrain/types';

/**
 * The mountain's cable car (#154): a rope from a station beside the pool, over a pylon, to a
 * station under the summit of the great peak. A red cabin goes up and down it, waiting a
 * little in each station. A function of the time only, like the herd.
 */

/** From the rope down to the floor of the cabin. */
export const HANG = 1.3;
/** Ropes over the ground at the bottom station, a pylon (at least), the top station. */
export const ROPE_OVER = { bottom: 1.6, pylon: 4, top: 1.6 } as const;
/** Sag of a rope, as a share of its span. */
const SAG = 0.03;
const SAMPLES = 16;
/** Cabins' speed in units per second, and seconds they wait in a station. */
const SPEED = 1.8;
const WAIT = 4;

type Vec3 = [number, number, number];

/** How far a rope hangs under the straight line between its supports, at a share of its span. */
export function sagAt(span: number, t: number): number {
  return 4 * SAG * span * t * (1 - t);
}

/** Heading of the line from the bottom station up, for a model facing +z. */
export function headingOf(c: Cableway): number {
  const a = c.supports[0];
  const b = c.supports[c.supports.length - 1];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Points along the rope, sagging between its supports. */
export function ropePoints(c: Cableway): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k + 1 < c.supports.length; k++) {
    const a = c.supports[k];
    const b = c.supports[k + 1];
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    for (let i = k === 0 ? 0 : 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      out.push([
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t - sagAt(span, t),
        a.z + (b.z - a.z) * t,
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

/** Where the cabin hangs at a time: the point of the rope it runs on. */
export function cabinAt(c: Cableway, time: number): CabinPose {
  const rope = ropePoints(c);
  const lengths = [0];
  for (let i = 1; i < rope.length; i++) {
    const [a, b] = [rope[i - 1], rope[i]];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const length = lengths[lengths.length - 1];
  const trip = length / SPEED;
  const period = 2 * (trip + WAIT);
  const t = ((time % period) + period) % period;
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
  /** One place in the swatch for every face, instead of its slope. */
  shade?: number,
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
    outward(out, quad, world, swatchUV(name, shade ?? shadeOf(world[1])));
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
 * A station: a little hut with a red roof on a stone base reaching `deep` into the slope,
 * behind the end of the ropes (`back` -1 at the bottom, 1 at the top), where a cabin waits
 * at its door.
 */
function station(out: MeshWriter, f: Frame, back: number, deep: number): void {
  block(out, f, [0, -deep / 2, back * 0.5], [0.9, deep / 2 + 0.1, 1.05], 'Stone');
  block(out, f, [0, 0.55, back * 0.75], [0.75, 0.55, 0.6], 'Cream');
  block(out, f, [0, 0.65, back * 0.75 - back * 0.61], [0.32, 0.25, 0.02], 'HexWater');
  roof(out, f, [0, 1.1, back * 0.75], 0.88, 0.72, 0.6);
}

/** A pylon: a single mast, a saddle on top carrying the rope. */
function pylon(out: MeshWriter, f: Frame, height: number): void {
  const top = height - 0.12;
  beam(out, place(f, [0, -0.4, 0]), place(f, [0, top * 0.5, 0]), 0.2, 0.2, 'Stone');
  beam(out, place(f, [0, top * 0.5, 0]), place(f, [0, top + 0.08, 0]), 0.15, 0.15, 'Stone');
  block(out, f, [0, top + 0.08, 0], [0.12, 0.07, 0.3], 'DarkBark');
}

/** The stations, the pylon and the rope, in one mesh. */
export function cablewayMesh(c: Cableway): MeshData {
  const out = new MeshWriter(2048, 4096);
  const yaw = headingOf(c);
  const s = c.supports;
  s.forEach((support, i) => {
    const f = { x: support.x, y: support.ground, z: support.z, yaw };
    if (i === 0) station(out, f, -1, 0.8);
    // High on the peak, on a stone buttress into its steep slope.
    else if (i === s.length - 1) station(out, { ...f, y: support.y - ROPE_OVER.bottom }, 1, 2);
    else pylon(out, f, support.y - support.ground);
  });
  const rope = ropePoints(c);
  for (let i = 1; i < rope.length; i++) beam(out, rope[i - 1], rope[i], 0.05, 0.05, 'DarkBark');
  return out.toMeshData();
}

/** Deep end of the red swatch. */
const RED = 0.9;

/** A red cabin hanging from its rope: the carriage on the rope at the origin, facing +z. */
export function cabin(): MeshData {
  const out = new MeshWriter(256, 512);
  const f = { x: 0, y: 0, z: 0, yaw: 0 };
  beam(out, [0, 0, 0], [0, -0.55, 0], 0.06, 0.06, 'DarkBark');
  const floor = -HANG;
  // All red, deep red, but a thin band of windows: it stands out on the rock and the snow.
  block(out, f, [0, floor + 0.2, 0], [0.36, 0.2, 0.42], 'PetalRed', 'PetalRed', RED);
  block(out, f, [0, floor + 0.5, 0], [0.35, 0.1, 0.41], 'HexWater');
  block(out, f, [0, floor + 0.66, 0], [0.39, 0.06, 0.45], 'PetalRed', 'PetalRed', RED);
  return out.toMeshData();
}
