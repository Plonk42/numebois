import type { SwatchName } from '../atlas';
import type { MeshWriter } from '../mesh-data';
import { beam } from '../props';

type Vec = readonly [number, number, number];

/** A rope bridge between two islands, or the great suspension bridge with its towers. */
export interface Bridge {
  from: Vec;
  to: Vec;
  kind: 'rope' | 'suspension';
}

/** Half width of the deck. */
const DECK = { rope: 0.55, suspension: 0.75 } as const;
/** Sag of the deck, as a share of the span. */
const SAG = { rope: 0.09, suspension: 0.035 } as const;
const PLANK_STEP = 0.42;

/** Point of a sagging line between a and b at t (0 to 1). */
function sagging(a: Vec, b: Vec, t: number, sag: number): Vec {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t),
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Line of beams along a sagging curve. */
function rope(out: MeshWriter, a: Vec, b: Vec, sag: number, size: number, swatch: SwatchName) {
  const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const steps = Math.max(3, Math.round(span / 1.1));
  for (let i = 0; i < steps; i++) {
    beam(
      out,
      sagging(a, b, i / steps, sag),
      sagging(a, b, (i + 1) / steps, sag),
      size,
      size,
      swatch,
    );
  }
}

/**
 * Planks hanging between two posts on each side, with hand ropes; the suspension bridge
 * has tall towers whose cables carry the deck.
 */
export function buildBridge(out: MeshWriter, bridge: Bridge): void {
  const { from: a, to: b, kind } = bridge;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const span = Math.hypot(dx, dz) || 1;
  const sx = -dz / span;
  const sz = dx / span;
  const half = DECK[kind];
  const sag = SAG[kind] * span;
  const side = (p: Vec, k: number, lift = 0): Vec => [p[0] + sx * k, p[1] + lift, p[2] + sz * k];

  const planks = Math.max(4, Math.round(span / PLANK_STEP));
  for (let i = 0; i <= planks; i++) {
    const p = sagging(a, b, i / planks, sag);
    beam(out, side(p, -half), side(p, half), PLANK_STEP * 0.78, 0.08, 'Earth');
  }

  const post = kind === 'suspension' ? 3.2 : 1.1;
  const thick = kind === 'suspension' ? 0.26 : 0.14;
  for (const end of [a, b]) {
    for (const k of [-1, 1]) {
      const foot = side(end, k * (half + 0.05), -0.5);
      beam(out, foot, side(end, k * (half + 0.05), post), thick, thick, 'DarkBark');
    }
    if (kind === 'suspension') {
      // A crossbar between the two towers.
      beam(out, side(end, -half, post - 0.35), side(end, half, post - 0.35), 0.2, 0.2, 'DarkBark');
    }
  }

  const rail = 0.95;
  for (const k of [-1, 1]) {
    const ra = side(a, k * half, rail);
    const rb = side(b, k * half, rail);
    rope(out, ra, rb, sag, 0.07, 'Cream');
    if (kind === 'suspension') {
      // The main cable from tower top to tower top, low in the middle.
      const ca = side(a, k * (half + 0.05), post - 0.1);
      const cb = side(b, k * (half + 0.05), post - 0.1);
      const drop = post - 0.1 - rail + sag + 0.25;
      rope(out, ca, cb, drop, 0.1, 'Cream');
      const hangers = Math.max(3, Math.round(span / 1.2));
      for (let i = 1; i < hangers; i++) {
        const t = i / hangers;
        const top = sagging(ca, cb, t, drop);
        const deck = side(sagging(a, b, t, sag), k * half, 0.05);
        if (top[1] - deck[1] > 0.3) beam(out, deck, top, 0.05, 0.05, 'Cream');
      }
    } else {
      // A few ropes from the hand rope down to the deck.
      const hangers = Math.max(2, Math.round(span / 1.6));
      for (let i = 1; i < hangers; i++) {
        const t = i / hangers;
        const deck = side(sagging(a, b, t, sag), k * half, 0.05);
        beam(out, deck, sagging(ra, rb, t, sag), 0.045, 0.045, 'Cream');
      }
    }
  }
}
