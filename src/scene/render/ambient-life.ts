import * as THREE from 'three';
import { Rng, hashSeed } from '../../core/rng';
import type { AnimalClip, AnimalName } from '../animal-catalog';
import type { AnimalBody, AnimalLibrary } from '../animals';
import { ANIMALS } from '../animals.gen';
import type { Terrain } from '../terrain/types';

/** Height in the scene: about twice life size next to 2.4 to 3 tall trees, to read from the camera (#9). */
export const ANIMAL_HEIGHT: Record<AnimalName, number> = {
  Deer: 1.6,
  Stag: 2.0,
  Fox: 0.85,
  Wolf: 1.1,
  Donkey: 1.4,
  Alpaca: 1.6,
  Horse: 1.9,
  Cow: 1.6,
  Chamois: 1.3,
  Ibex: 1.7,
  Marmot: 0.6,
  Eagle: 0.9,
};
/** Half width of the diorama when the first animal arrives: larger ones are seen from further. */
const FIRST_EXTENT = 19;

/** Steps per walk cycle, as a share of the body length: keeps the feet from sliding. */
const STRIDE = 0.45;
/** Seconds to blend from one clip to the next, and to turn at the start of a walk. */
const BLEND = 0.4;
const TURN = 0.8;
/** Places visited in turn by each animal. */
const STOPS = 3;
/**
 * A touch of the child (#28): the animal stops, turns towards the camera in TURN_TO seconds
 * (three-quarters, a profile reads better than a face), jumps, gallops a loop around and
 * back (or looks for LOOK seconds where there is no room), faces the child again for REST
 * seconds, turns back and goes on with its day where it left it.
 */
const TURN_TO = 0.5;
const LOOK = 1.2;
const REST = 0.6;
const FACING = 0.75;
/** Ground covered per gallop cycle, as a share of the body length. */
const GALLOP_STRIDE = 0.8;
/**
 * At night (#119), touched, a sleeping animal gets up in RISE seconds, turns to the child,
 * looks for LOOK seconds, turns back and lies down again: no jump, no gallop.
 */
const RISE = 1.2;
/** Height of a lying animal, as a share of its standing height. */
const LYING = 0.5;
/**
 * Asleep, it lies across the view, its left flank (where the head curls round, see
 * `scripts/sleep.py`) towards the camera: headings from SIDEWAYS - TURNED to SIDEWAYS + TURNED.
 */
const SIDEWAYS = -Math.PI / 2 + 0.3;
const TURNED = 0.4;
/** Radii of the loop tried, as shares of the body length, largest first. */
const RUN_RADII = [1, 0.75, 0.55];
/** Where the loop may lie, from the side of the camera round to behind the animal. */
const RUN_SIDES = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => (k * Math.PI) / 4);
const TAU = Math.PI * 2;

interface Point {
  x: number;
  y: number;
  z: number;
}

/** A stretch of an animal's day: one clip, still or walking from one point to the next. */
interface Leg {
  clip: AnimalClip;
  start: number;
  end: number;
  /** Ground under the path, sampled evenly from `from` to `to` (one point when still). */
  path: Point[];
  yaw: number;
  /** Heading before the leg, to turn smoothly into a walk. */
  previousYaw: number;
}

export interface HerdMember {
  name: AnimalName;
  scale: number;
  legs: Leg[];
  /** Length of the loop, in seconds, and where in it the animal starts. */
  period: number;
  phase: number;
  /** Asleep all night where its day starts. */
  asleep: boolean;
}

function wraps(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Where the animals the child bought live and what they do, as a pure function of the seed:
 * the Album replays the same scene. Animals are placed in buying order, each from its own
 * draw, so a newcomer never moves the others. Bought, they are never cut by the quality tier.
 * At night they all sleep where their day starts, but the wolves, who keep watch (#119).
 */
export function planHerd(
  terrain: Terrain,
  animals: readonly AnimalName[],
  seed: number,
  night = false,
): HerdMember[] {
  const members: HerdMember[] = [];
  const homes: Point[] = [];
  const counts = new Map<AnimalName, number>();
  for (const name of animals) {
    const n = counts.get(name) ?? 0;
    counts.set(name, n + 1);
    const rng = new Rng(hashSeed(seed, `animal:${name}:${n}`));
    const member =
      name === 'Wolf' && n === 0 && terrain.perch
        ? planOnPerch(terrain, terrain.perch, rng)
        : planMember(terrain, rng, name, homes);
    if (member) members.push(night && name !== 'Wolf' ? asleep(member, rng) : member);
  }
  return members;
}

/** Lying where its day starts, breathing slowly. */
function asleep(member: HerdMember, rng: Rng): HerdMember {
  const yaw = SIDEWAYS + rng.range(-TURNED, TURNED);
  const breath = ANIMALS[member.name].clips.sleep;
  const leg: Leg = {
    clip: 'sleep',
    start: 0,
    end: breath,
    path: [member.legs[0].path[0]],
    yaw,
    previousYaw: yaw,
  };
  return { ...member, legs: [leg], period: breath, phase: rng.range(0, breath), asleep: true };
}

function sizeOf(terrain: Terrain, name: AnimalName): { scale: number; length: number } {
  const info = ANIMALS[name];
  const zoom = Math.sqrt(Math.max(1, terrain.extent.x / FIRST_EXTENT));
  const scale = (zoom * ANIMAL_HEIGHT[name]) / (info.max[1] - info.min[1]);
  return { scale, length: (info.max[2] - info.min[2]) * scale };
}

/** The wolf watches over the valley from its ledge, and crosses it now and then. */
function planOnPerch(terrain: Terrain, perch: NonNullable<Terrain['perch']>, rng: Rng): HerdMember {
  const { scale, length } = sizeOf(terrain, 'Wolf');
  // Three-quarters towards the middle of the valley: a profile reads better than a face.
  const gaze = perch.x >= 0 ? -0.9 : 0.9;
  const side = Math.min(perch.radius * 0.55, length * 0.6);
  const at = (s: number): Point => ({
    x: perch.x + Math.cos(gaze) * side * s,
    y: perch.y,
    z: perch.z - Math.sin(gaze) * side * s,
  });
  const stops = [at(1), at(-1)];
  const paths = [
    [stops[0], stops[1]],
    [stops[1], stops[0]],
  ];
  const still = () => ['idle', 'look', 'idle'] as const;
  return {
    name: 'Wolf',
    scale,
    asleep: false,
    ...schedule(rng, 'Wolf', stops, paths, length, still, gaze),
  };
}

const AROUND = Array.from({ length: 8 }, (_, i) => [
  Math.cos((i * Math.PI) / 4),
  Math.sin((i * Math.PI) / 4),
]);
const SIDES = AROUND.filter((_, i) => i % 2 === 0);

/** Open grass, away from water, trees and large rocks, where the camera sees it. */
function openGround(
  terrain: Terrain,
  x: number,
  z: number,
  room: number,
  around = AROUND,
): Point | null {
  const { extent } = terrain;
  if (Math.abs(x) > extent.x * 0.75 || z < -extent.z * 0.45 || z > extent.z * 0.75) return null;
  for (const tree of terrain.treeSpots) {
    if (Math.hypot(tree.x - x, tree.z - z) < 1.2 + room * 0.5) return null;
  }
  // The child's slots stay free, whatever grows there.
  for (const slot of terrain.slots) {
    if (Math.hypot(slot.x - x, slot.z - z) < 1.4 * slot.size + room * 0.5) return null;
  }
  for (const moment of terrain.announcements) {
    if (Math.hypot(moment.x - x, moment.z - z) < moment.radius + room) return null;
  }
  const dam = terrain.dam;
  if (dam && Math.hypot(dam.x - x, dam.z - z) < dam.width + room) return null;
  for (const support of terrain.cableway?.supports ?? []) {
    if (Math.hypot(support.x - x, support.z - z) < 3 + room) return null;
  }
  for (const rock of terrain.staticModels) {
    if (Math.hypot(rock.x - x, rock.z - z) < 2.5 * rock.scale + room) return null;
  }
  const surface = terrain.surfaceAt(x, z);
  if (surface?.kind !== 'grass' || surface.slope > 0.3) return null;
  for (const [dx, dz] of around) {
    const near = terrain.surfaceAt(x + dx * room, z + dz * room);
    if (!near || near.kind === 'water') return null;
  }
  return { x, y: surface.y, z };
}

/** Ground a touched animal may gallop over (#28): looser than where it lives, never wet or rocky. */
function runGround(terrain: Terrain, x: number, z: number, room: number): number | null {
  for (const tree of terrain.treeSpots) {
    if (Math.hypot(tree.x - x, tree.z - z) < 0.9 + room * 0.5) return null;
  }
  for (const slot of terrain.slots) {
    if (Math.hypot(slot.x - x, slot.z - z) < slot.size + room * 0.5) return null;
  }
  for (const moment of terrain.announcements) {
    if (Math.hypot(moment.x - x, moment.z - z) < moment.radius) return null;
  }
  const dam = terrain.dam;
  if (dam && Math.hypot(dam.x - x, dam.z - z) < dam.width + room * 0.5) return null;
  for (const rock of terrain.staticModels) {
    if (Math.hypot(rock.x - x, rock.z - z) < 2 * rock.scale + room * 0.5) return null;
  }
  const surface = terrain.surfaceAt(x, z);
  if (!surface || (surface.kind !== 'grass' && surface.kind !== 'sand') || surface.slope > 0.4) {
    return null;
  }
  return surface.y;
}

function walkable(terrain: Terrain, a: Point, b: Point, room: number): Point[] | null {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.7));
  const path: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const p = openGround(terrain, x, a.z + (b.z - a.z) * t, room * 0.5, SIDES);
    if (!p) return null;
    path.push(p);
  }
  return path;
}

function planMember(
  terrain: Terrain,
  rng: Rng,
  name: AnimalName,
  homes: Point[],
): HerdMember | null {
  const { scale, length } = sizeOf(terrain, name);
  const room = length * 0.6;
  for (let attempt = 0; attempt < 280; attempt++) {
    const home = openGround(
      terrain,
      rng.range(-0.75, 0.75) * terrain.extent.x,
      // Mostly towards the camera, where animals look larger.
      (-0.45 + 1.2 * Math.sqrt(rng.next())) * terrain.extent.z,
      room,
    );
    if (!home || homes.some((h) => Math.hypot(h.x - home.x, h.z - home.z) < 3.5)) continue;
    const stops = [home];
    // In a crowded meadow, a back-and-forth between two places will do, or grazing in one.
    const count = attempt < 60 ? STOPS : attempt < 120 ? 2 : 1;
    for (let s = 1; s < count && stops.length === s; s++) {
      for (let tries = 0; tries < 16; tries++) {
        const angle = rng.range(0, Math.PI * 2);
        const reach = rng.range(1.5, 3) * length;
        const stop = openGround(
          terrain,
          home.x + Math.cos(angle) * reach,
          home.z + Math.sin(angle) * reach,
          room,
        );
        if (stop && walkable(terrain, stops[s - 1], stop, room)) {
          stops.push(stop);
          break;
        }
      }
    }
    if (stops.length < count || !walkable(terrain, stops[count - 1], home, room)) continue;
    homes.push(home);
    const paths = stops.map((stop, s) => walkable(terrain, stop, stops[(s + 1) % count], room)!);
    const still = () =>
      rng.chance(0.6) ? (['eat', 'idle', 'look'] as const) : (['idle', 'eat'] as const);
    // Grazing in one place, three-quarters towards the camera.
    const gaze = count === 1 ? rng.range(-1, 1) : undefined;
    return {
      name,
      scale,
      asleep: false,
      ...schedule(rng, name, stops, paths, length, still, gaze),
    };
  }
  return null;
}

/**
 * The loop: at each stop a few still clips, then a walk along the path to the next stop.
 * Still, the animal keeps its heading, or turns to `gaze`.
 */
function schedule(
  rng: Rng,
  name: AnimalName,
  stops: Point[],
  paths: Point[][],
  length: number,
  still: () => readonly AnimalClip[],
  gaze?: number,
): Omit<HerdMember, 'name' | 'scale' | 'asleep'> {
  const clips = ANIMALS[name].clips;
  const speed = (STRIDE * length) / clips.walk;
  const legs: Leg[] = [];
  let time = 0;
  const heading = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);
  // The loop starts as the last walk ends: back home.
  let yaw = heading(stops[stops.length - 1], stops[0]);
  const add = (clip: AnimalClip, duration: number, path: Point[], heading: number) => {
    legs.push({ clip, start: time, end: time + duration, path, yaw: heading, previousYaw: yaw });
    time += duration;
    yaw = heading;
  };
  for (let s = 0; s < stops.length; s++) {
    const here = stops[s];
    const next = stops[(s + 1) % stops.length];
    for (const clip of still()) {
      const loops = Math.max(1, Math.round(rng.range(3, 7) / clips[clip]));
      add(clip, loops * clips[clip], [here], gaze ?? yaw);
    }
    const distance = Math.hypot(next.x - here.x, next.z - here.z);
    if (distance > 0) add('walk', distance / speed, paths[s], heading(here, next));
  }
  return { legs, period: time, phase: rng.range(0, time) };
}

/** Clip weights and placement of an animal at a time; reused to avoid allocations. */
export interface AnimalState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  clip: AnimalClip;
  clipTime: number;
  /** Previous clip, fading out at the start of a leg (weight 1 - blend). */
  fading: AnimalClip | null;
  fadingTime: number;
  blend: number;
}

export function animalState(member: HerdMember, time: number, out: AnimalState): AnimalState {
  const { legs, period } = member;
  const u = (((time + member.phase) % period) + period) % period;
  let i = 0;
  while (i < legs.length - 1 && u >= legs[i].end) i++;
  const leg = legs[i];
  const local = u - leg.start;
  const t = Math.min(1, local / (leg.end - leg.start));
  const f = t * (leg.path.length - 1);
  const k = Math.min(leg.path.length - 2, Math.floor(f));
  if (leg.path.length === 1) {
    out.x = leg.path[0].x;
    out.y = leg.path[0].y;
    out.z = leg.path[0].z;
  } else {
    const a = leg.path[k];
    const b = leg.path[k + 1];
    const s = f - k;
    out.x = a.x + (b.x - a.x) * s;
    out.y = a.y + (b.y - a.y) * s;
    out.z = a.z + (b.z - a.z) * s;
  }
  const turn = Math.min(1, local / TURN);
  const ease = turn * turn * (3 - 2 * turn);
  out.yaw = leg.previousYaw + wraps(leg.yaw - leg.previousYaw) * ease;
  out.clip = leg.clip;
  out.clipTime = local;
  const previous = legs[(i + legs.length - 1) % legs.length];
  // A clip that goes on (the sleep, night long) never fades towards the rest pose.
  const fades = previous.clip !== leg.clip;
  out.blend = fades ? Math.min(1, local / BLEND) : 1;
  out.fading = fades && out.blend < 1 ? previous.clip : null;
  out.fadingTime = previous.end - previous.start + local;
  return out;
}

/** Triangles of a herd, for the budget. */
export function herdTriangles(members: readonly HerdMember[]): number {
  return members.reduce((sum, m) => sum + ANIMALS[m.name].triangles, 0);
}

/** A loop galloped around a centre, from the animal's place back to it. */
interface Run {
  cx: number;
  cz: number;
  radius: number;
  /** Angle of the start around the centre, and 1 or -1 for the way round. */
  from: number;
  way: number;
  /** Ground height at even steps round the loop, the start repeated at the end. */
  heights: number[];
  seconds: number;
}

/** A loop of open grass through `from`, the nearer the camera the better; null without room. */
function planRun(
  terrain: Terrain,
  name: AnimalName,
  from: Point,
  facing: number,
  way: number,
): Run | null {
  const { length } = sizeOf(terrain, name);
  const room = length * 0.6;
  for (const share of RUN_RADII) {
    const radius = share * length;
    const steps = Math.max(12, Math.ceil((TAU * radius) / 0.5));
    for (const side of RUN_SIDES) {
      const cx = from.x + Math.sin(facing + side) * radius;
      const cz = from.z + Math.cos(facing + side) * radius;
      const start = Math.atan2(from.x - cx, from.z - cz);
      const heights = [from.y];
      for (let i = 1; i < steps; i++) {
        const a = start + (way * TAU * i) / steps;
        const y = runGround(terrain, cx + Math.sin(a) * radius, cz + Math.cos(a) * radius, room);
        if (y === null) break;
        heights.push(y);
      }
      if (heights.length < steps) continue;
      heights.push(from.y);
      const speed = (GALLOP_STRIDE * length) / ANIMALS[name].clips.gallop;
      return { cx, cz, radius, from: start, way, heights, seconds: (TAU * radius) / speed };
    }
  }
  return null;
}

interface Reaction {
  start: number;
  /** Time of the animal's day when it stopped. */
  frozen: number;
  /** Heading towards the camera. */
  yaw: number;
  jump: number;
  run: Run | null;
  length: number;
  /** Woken up at night: it gets up and lies down again. */
  wakes: boolean;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

const smooth = (t: number) => t * t * (3 - 2 * t);

/** The animals of a painting, posed every frame from the time alone. */
export class Herd {
  readonly group = new THREE.Group();
  triangles = 0;
  private readonly bodies: {
    member: HerdMember;
    body: AnimalBody;
    /** Time spent reacting to touches, out of the animal's day. */
    held: number;
    reaction: Reaction | null;
  }[] = [];
  private readonly state: AnimalState = {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    clip: 'idle',
    clipTime: 0,
    fading: null,
    fadingTime: 0,
    blend: 1,
  };

  constructor(
    private readonly library: AnimalLibrary,
    members: readonly HerdMember[],
    private readonly terrain: Terrain,
  ) {
    this.group.name = 'herd';
    for (const member of members) this.add(member);
  }

  get size(): number {
    return this.bodies.length;
  }

  add(member: HerdMember): void {
    const body = this.library.create(member.name);
    body.object.scale.setScalar(member.scale);
    this.group.add(body.object);
    this.bodies.push({ member, body, held: 0, reaction: null });
    this.triangles += body.triangles;
  }

  /** Where each animal stands and how tall it is, to find the one the child touches. */
  spots(): {
    name: AnimalName;
    x: number;
    y: number;
    z: number;
    height: number;
    asleep: boolean;
  }[] {
    return this.bodies.map(({ member, body, reaction }) => {
      const { min, max } = ANIMALS[member.name];
      const lying = member.asleep && !reaction;
      return {
        name: member.name,
        x: body.object.position.x,
        y: body.object.position.y,
        z: body.object.position.z,
        height: (max[1] - min[1]) * member.scale * (lying ? LYING : 1),
        asleep: lying,
      };
    });
  }

  /**
   * The animal `index` reacts to a touch, turning towards `toward`: the length of its
   * reaction in seconds, 0 while it already reacts.
   */
  react(index: number, time: number, toward: { x: number; z: number }): number {
    const entry = this.bodies[index];
    if (!entry || (entry.reaction && time < entry.reaction.start + entry.reaction.length)) {
      return 0;
    }
    if (entry.reaction) entry.held += entry.reaction.length;
    const frozen = time - entry.held;
    const s = animalState(entry.member, frozen, this.state);
    const face = Math.atan2(toward.x - s.x, toward.z - s.z);
    const yaw = s.yaw + wraps(face - s.yaw) * FACING;
    const { name } = entry.member;
    if (entry.member.asleep) {
      const length = 2 * (RISE + TURN_TO) + LOOK;
      entry.reaction = { start: time, frozen, yaw, jump: 0, run: null, length, wakes: true };
      return length;
    }
    const run = planRun(this.terrain, name, s, yaw, index % 2 === 0 ? 1 : -1);
    const jump = ANIMALS[name].clips.jump;
    entry.reaction = {
      start: time,
      frozen,
      yaw,
      jump,
      run,
      length: 2 * TURN_TO + jump + (run ? run.seconds + REST : LOOK),
      wakes: false,
    };
    return entry.reaction.length;
  }

  update(time: number): void {
    const s = this.state;
    for (const entry of this.bodies) {
      const { member, body, reaction } = entry;
      if (reaction && time >= reaction.start + reaction.length) {
        entry.held += reaction.length;
        entry.reaction = null;
      }
      const r = entry.reaction;
      animalState(member, r ? r.frozen : time - entry.held, s);
      body.object.position.set(s.x, s.y, s.z);
      if (r) {
        if (r.wakes) this.poseWaking(body, r, time - r.start, s);
        else this.poseReaction(body, r, time - r.start, s);
        continue;
      }
      body.object.rotation.y = s.yaw;
      body.pose(s.clip, s.clipTime, s.blend);
      if (s.fading) body.pose(s.fading, s.fadingTime, 1 - s.blend);
      body.apply();
    }
  }

  /**
   * The clip it was playing fades into a jump, then a gallop round the loop, between idles;
   * it turns to the child, runs, faces the child again and turns back.
   */
  private poseReaction(body: AnimalBody, r: Reaction, local: number, s: AnimalState): void {
    const left = r.length - local;
    const runStart = TURN_TO + r.jump;
    const runEnd = runStart + (r.run?.seconds ?? 0);
    let yaw: number;
    let gallop = 0;
    const run = r.run;
    if (!run || local < runStart) {
      yaw = s.yaw + wraps(r.yaw - s.yaw) * smooth(clamp01(local / TURN_TO));
    } else {
      const u = clamp01((local - runStart) / run.seconds);
      const a = run.from + run.way * TAU * u;
      const tangent = a + (run.way * Math.PI) / 2;
      const f = u * (run.heights.length - 1);
      const k = Math.min(run.heights.length - 2, Math.floor(f));
      const y = run.heights[k] + (run.heights[k + 1] - run.heights[k]) * (f - k);
      body.object.position.set(
        run.cx + Math.sin(a) * run.radius,
        y,
        run.cz + Math.cos(a) * run.radius,
      );
      yaw =
        local < runEnd
          ? r.yaw + wraps(tangent - r.yaw) * smooth(clamp01((local - runStart) / 0.3))
          : tangent + wraps(r.yaw - tangent) * smooth(clamp01((local - runEnd) / 0.4));
    }
    if (run) gallop = clamp01(Math.min((local - runStart + 0.2) / 0.25, (runEnd - local) / 0.35));
    if (left < TURN_TO) yaw = s.yaw + wraps(yaw - s.yaw) * smooth(clamp01(left / TURN_TO));
    body.object.rotation.y = yaw;
    const own = clamp01(Math.min(local / BLEND, left / BLEND));
    const jumpTime = local - TURN_TO;
    const jump = clamp01(Math.min((jumpTime + 0.15) / 0.15, (r.jump - jumpTime) / 0.25));
    gallop = Math.min(gallop, 1 - jump);
    body.pose(s.clip, s.clipTime, 1 - own);
    body.pose('idle', local, own * (1 - jump - gallop));
    body.pose('jump', Math.max(0, Math.min(jumpTime, r.jump - 1e-3)), own * jump);
    body.pose('gallop', Math.max(0, local - runStart + 0.2), own * gallop);
    body.apply();
  }

  /** Up from its sleep, a look at the child, and down again: the blend of the clips does it. */
  private poseWaking(body: AnimalBody, r: Reaction, local: number, s: AnimalState): void {
    const left = r.length - local;
    const up = smooth(clamp01(Math.min(local, left) / RISE));
    const facing = smooth(clamp01((Math.min(local, left) - RISE) / TURN_TO));
    body.object.rotation.y = s.yaw + wraps(r.yaw - s.yaw) * facing;
    body.pose('sleep', s.clipTime, 1 - up);
    body.pose('idle', local, up);
    body.apply();
  }

  dispose(): void {
    for (const { body } of this.bodies) body.dispose();
  }
}
