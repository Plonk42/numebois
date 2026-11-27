import type { AnimalClip } from '../animal-catalog';
import type { Drifter } from '../terrain/types';

/**
 * The eagles of the mountain (#136): each soars on its loop, now and then glides down to a
 * summit, rests there a while and takes off again, a summit after the other. A function of
 * the time only, like the herd: the same picture for the same time.
 *
 * A round: soaring at least SOAR seconds, then the eagle leaves its loop once it heads for
 * the summit (no U-turn), glides down, rests REST seconds or more, and takes off to join
 * its loop again where the loop heads away from the summit. It flies at about SPEED, in
 * MOVE seconds or more.
 */
const SOAR = 12;
const MOVE = 4;
const LONGEST = 9;
const SPEED = 3.5;
const REST = 12;
/** Below the eagle's origin, its toes when perched (`scripts/eagle.py`), in model units. */
export const EAGLE_FEET = 0.35;
/** The eagle's model is 2.5 wide, the generated one (`eagle` of `props.ts`) 2. */
export const EAGLE_SCALE = 0.8;
const BLEND = 0.4;
const STEP = 0.05;
/** How well the loop must head for the summit (or away from it) to leave it (or join it). */
const AIMED = 0.7;

type Vec3 = [number, number, number];

export interface SoarPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  clips: { clip: AnimalClip; weight: number }[];
}

interface Round {
  start: number;
  /** Leaves its loop, lands, takes off, joins its loop again. */
  leave: number;
  land: number;
  rise: number;
  join: number;
  perch: Vec3;
}

/** Seconds of a flight between two points. */
function flight(from: Vec3, to: Vec3): number {
  return Math.min(LONGEST, Math.max(MOVE, Math.hypot(...minus(to, from)) / SPEED));
}

function loop(d: Drifter, time: number): Vec3 {
  const a = time * d.speed * 2 * Math.PI;
  return [
    d.x + Math.cos(a) * d.rx,
    d.y + Math.sin(time * 0.4 + d.rx) * 0.25,
    d.z + Math.sin(a) * d.rz,
  ];
}

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaled = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

function velocity(d: Drifter, t: number): Vec3 {
  return scaled(minus(loop(d, t + STEP), loop(d, t - STEP)), 0.5 / STEP);
}

/** Horizontal unit vector. */
function flat(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[2]) || 1;
  return [v[0] / l, 0, v[2] / l];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[2] * b[2];
/** Ground covered towards a point, at least: no sharp turn over a summit under the loop. */
const AHEAD = 4;

/** How well the loop at a time heads from `from` to `to`, far enough ahead. */
function heads(d: Drifter, t: number, from: Vec3, to: Vec3): number {
  const way = minus(to, from);
  const v = flat(velocity(d, t));
  return dot(v, way) < AHEAD ? -1 : dot(v, flat(way));
}

/** First time from `from` on, within a loop, when `aim` is good enough; else the best one. */
function aimed(d: Drifter, from: number, aim: (t: number) => number): number {
  const period = 1 / Math.abs(d.speed);
  let best = from;
  let score = -Infinity;
  for (let t = from; t <= from + period; t += 0.25) {
    const s = aim(t);
    if (s >= AIMED) return t;
    if (s > score) [best, score] = [t, s];
  }
  return best;
}

function lengthOf(d: Drifter): number {
  return SOAR + REST + 2 * LONGEST + 2 / Math.abs(d.speed) + 2;
}

const rounds = new WeakMap<Drifter, Map<number, Round>>();

function roundAt(d: Drifter, index: number, time: number): { round: Round | null; k: number } {
  const length = lengthOf(d);
  // Two eagles out of step.
  const offset = (index * length) / 2;
  const k = Math.floor((time + offset) / length);
  const perches = d.perches ?? [];
  if (perches.length === 0) return { round: null, k };
  let cache = rounds.get(d);
  if (!cache) rounds.set(d, (cache = new Map()));
  let round = cache.get(k);
  if (!round) {
    const start = k * length - offset;
    const [x, y, z] = perches[(((k + index) % perches.length) + perches.length) % perches.length];
    const perch: Vec3 = [x, y + EAGLE_FEET * EAGLE_SCALE * d.scale, z];
    const leave = aimed(d, start + SOAR, (t) => heads(d, t, loop(d, t), perch));
    const land = leave + flight(loop(d, leave), perch);
    // Rests until it can take off and join its loop heading away from the summit.
    const join = aimed(d, land + REST + LONGEST, (t) => heads(d, t, perch, loop(d, t)));
    const rise = join - flight(perch, loop(d, join));
    round = { start, leave, land, rise, join, perch };
    if (cache.size > 8) cache.clear();
    cache.set(k, round);
  }
  return { round, k };
}

function hermite(p0: Vec3, m0: Vec3, p1: Vec3, m1: Vec3, u: number): Vec3 {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [0, 1, 2].map((i) => h00 * p0[i] + h10 * m0[i] + h01 * p1[i] + h11 * m1[i]) as Vec3;
}

/** Comes in from above, facing the way it flew. */
function arrival(d: Drifter, r: Round): Vec3 {
  return flat(minus(r.perch, loop(d, r.leave)));
}

/** Takes off the way it will fly on its loop. */
function departure(d: Drifter, r: Round): Vec3 {
  return flat(velocity(d, r.join));
}

function where(d: Drifter, index: number, time: number): Vec3 {
  const { round: r } = roundAt(d, index, time);
  if (!r || time < r.leave || time >= r.join) return loop(d, time);
  if (time < r.land) {
    const dir = arrival(d, r);
    const span = r.land - r.leave;
    const m1 = scaled([dir[0] * 1.5, -2.5, dir[2] * 1.5], span / MOVE);
    const from = loop(d, r.leave);
    return hermite(from, scaled(velocity(d, r.leave), span), r.perch, m1, (time - r.leave) / span);
  }
  if (time < r.rise) return r.perch;
  const dir = departure(d, r);
  const span = r.join - r.rise;
  const m0 = scaled([dir[0] * 1.5, 3, dir[2] * 1.5], span / MOVE);
  const to = loop(d, r.join);
  return hermite(r.perch, m0, to, scaled(velocity(d, r.join), span), (time - r.rise) / span);
}

const heading = (v: Vec3) => Math.atan2(v[0], v[2]);

/**
 * At night (#119) each eagle sleeps on a summit of its own, its head turned back, three-quarters
 * to the camera.
 */
function asleep(d: Drifter, index: number, perches: NonNullable<Drifter['perches']>): SoarPose {
  const [x, y, z] = perches[index % perches.length];
  const yaw = index % 2 === 0 ? 0.7 : -0.7;
  const feet = EAGLE_FEET * EAGLE_SCALE * d.scale;
  return { x, y: y + feet, z, yaw, pitch: 0, roll: 0, clips: [{ clip: 'sleep', weight: 1 }] };
}

function wrap(a: number): number {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

/** Clips of a round: [start, end, clip], blended where they meet. */
function timeline(r: Round, length: number): [number, number, AnimalClip][] {
  const { start, leave, land, rise } = r;
  const beats: [number, number, AnimalClip][] = [3, 11, 19, 27]
    .map((at) => start + at)
    .filter((at) => at + 1.6 < leave - 1)
    .map((at) => [at, at + 1.6, 'walk']);
  return [
    [start - BLEND, land - 1.2, 'gallop'],
    ...beats,
    [land - 1.2, land + 0.6, 'jump'],
    [land + 0.6, land + 3, 'idle'],
    [land + 3, land + 6.5, 'look'],
    [land + 6.5, land + 7.5, 'idle'],
    [land + 7.5, land + 10, 'eat'],
    [land + 10, rise, 'idle'],
    [rise, rise + 1.2, 'jump'],
    [rise + 1.2, rise + 3.6, 'walk'],
    [rise + 3.6, start + length + BLEND, 'gallop'],
  ];
}

export function soarPose(d: Drifter, index: number, time: number, night = false): SoarPose {
  const perches = d.perches ?? [];
  if (night && perches.length > 0) return asleep(d, index, perches);
  const p = where(d, index, time);
  const before = where(d, index, time - STEP);
  const after = where(d, index, time + STEP);
  const v = minus(after, before);
  let yaw = heading(v);
  let pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(v[1], Math.hypot(v[0], v[2])) * 0.6));
  const turn = wrap(heading(minus(after, p)) - heading(minus(p, before))) / STEP;
  let roll = Math.max(-0.5, Math.min(0.5, -turn * 0.35));
  const { round: r } = roundAt(d, index, time);
  if (r && time >= r.land - 1 && time < r.rise + 1) {
    // Upright on the summit, facing the way it came in, then the way it will go.
    const came = heading(arrival(d, r));
    const goes = heading(departure(d, r));
    const turning = Math.min(1, Math.max(0, (time - (r.rise - 1.5)) / 1.5));
    const rest = came + wrap(goes - came) * turning;
    const k = time < r.land ? r.land - time : time >= r.rise ? time - r.rise : 0;
    yaw = rest + wrap(yaw - rest) * k;
    pitch *= k;
    roll *= k;
  }
  if (!r)
    return { x: p[0], y: p[1], z: p[2], yaw, pitch, roll, clips: [{ clip: 'gallop', weight: 1 }] };
  const clips: SoarPose['clips'] = [];
  let total = 0;
  for (const [start, end, clip] of timeline(r, lengthOf(d))) {
    const weight =
      Math.min(1, Math.max(0, (time - start) / BLEND + 0.5)) *
      Math.min(1, Math.max(0, (end - time) / BLEND + 0.5));
    if (weight <= 0) continue;
    const found = clips.find((c) => c.clip === clip);
    if (found) found.weight += weight;
    else clips.push({ clip, weight });
    total += weight;
  }
  // A few beats in place of the gliding.
  const beat = clips.find((c) => c.clip === 'walk');
  const glide = clips.find((c) => c.clip === 'gallop');
  if (beat && glide) {
    total -= glide.weight * Math.min(1, beat.weight);
    glide.weight *= 1 - Math.min(1, beat.weight);
  }
  for (const c of clips) c.weight /= total;
  return { x: p[0], y: p[1], z: p[2], yaw, pitch, roll, clips };
}
