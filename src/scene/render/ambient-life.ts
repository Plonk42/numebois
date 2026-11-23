import * as THREE from 'three';
import { Rng, hashSeed } from '../../core/rng';
import { ANIMAL_NAMES, type AnimalClip, type AnimalName } from '../animal-catalog';
import type { AnimalBody, AnimalLibrary } from '../animals';
import { ANIMALS } from '../animals.gen';
import { STAGES } from '../description';
import type { Terrain } from '../terrain/types';
import type { QualitySettings } from './quality';
import { ambienceFor, type Ambience } from './richness';

/** Height in the scene: about twice life size next to 2.4 to 3 tall trees, to read from the camera (#9). */
export const ANIMAL_HEIGHT: Record<AnimalName, number> = {
  Deer: 1.6,
  Stag: 2.0,
  Fox: 0.85,
  Wolf: 1.1,
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
}

/** Stage at which the n-th animal of a kind arrives, from the columns of the stages. */
function arrival(name: AnimalName, n: number): number {
  return STAGES.find((stage) => ambienceFor(stage, 'summer').animals[name] > n) ?? Infinity;
}

function wraps(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Where the animals of a painting live and what they do, as a pure function of the seed: the
 * Album replays the same scene. Animals are placed in arrival order, each from its own draw,
 * so a newcomer never moves the others.
 */
export function planHerd(
  terrain: Terrain,
  ambience: Ambience,
  quality: QualitySettings,
  seed: number,
): HerdMember[] {
  const wanted = ANIMAL_NAMES.flatMap((name) =>
    Array.from({ length: ambience.animals[name] }, (_, n) => ({ name, n })),
  )
    .sort((a, b) => arrival(a.name, a.n) - arrival(b.name, b.n))
    .slice(0, quality.animals);
  const members: HerdMember[] = [];
  const homes: Point[] = [];
  for (const { name, n } of wanted) {
    const rng = new Rng(hashSeed(seed, `animal:${name}:${n}`));
    const member =
      name === 'Wolf' && n === 0 && terrain.perch
        ? planOnPerch(terrain, terrain.perch, rng)
        : planMember(terrain, rng, name, homes);
    if (member) members.push(member);
  }
  return members;
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
  const side = Math.min(perch.radius * 0.5, length * 0.4);
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
  return { name: 'Wolf', scale, ...schedule(rng, 'Wolf', stops, paths, length, still, gaze) };
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
  for (let attempt = 0; attempt < 80; attempt++) {
    const home = openGround(
      terrain,
      rng.range(-0.75, 0.75) * terrain.extent.x,
      // Mostly towards the camera, where animals look larger.
      (-0.45 + 1.2 * Math.sqrt(rng.next())) * terrain.extent.z,
      room,
    );
    if (!home || homes.some((h) => Math.hypot(h.x - home.x, h.z - home.z) < 3.5)) continue;
    const stops = [home];
    for (let s = 1; s < STOPS && stops.length === s; s++) {
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
    if (stops.length < STOPS || !walkable(terrain, stops[STOPS - 1], home, room)) continue;
    homes.push(home);
    const paths = stops.map((stop, s) => walkable(terrain, stop, stops[(s + 1) % STOPS], room)!);
    const still = () =>
      rng.chance(0.6) ? (['eat', 'idle', 'look'] as const) : (['idle', 'eat'] as const);
    return { name, scale, ...schedule(rng, name, stops, paths, length, still) };
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
): Omit<HerdMember, 'name' | 'scale'> {
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
    add('walk', distance / speed, paths[s], heading(here, next));
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
  out.blend = Math.min(1, local / BLEND);
  out.fading = out.blend < 1 && previous.clip !== leg.clip ? previous.clip : null;
  out.fadingTime = previous.end - previous.start + local;
  return out;
}

/** Triangles of a herd, for the budget. */
export function herdTriangles(members: readonly HerdMember[]): number {
  return members.reduce((sum, m) => sum + ANIMALS[m.name].triangles, 0);
}

/** The animals of a painting, posed every frame from the time alone. */
export class Herd {
  readonly group = new THREE.Group();
  readonly triangles: number;
  private readonly bodies: { member: HerdMember; body: AnimalBody }[];
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

  constructor(library: AnimalLibrary, members: readonly HerdMember[]) {
    this.group.name = 'herd';
    this.bodies = members.map((member) => {
      const body = library.create(member.name);
      body.object.scale.setScalar(member.scale);
      this.group.add(body.object);
      return { member, body };
    });
    this.triangles = this.bodies.reduce((sum, b) => sum + b.body.triangles, 0);
  }

  update(time: number): void {
    const s = this.state;
    for (const { member, body } of this.bodies) {
      animalState(member, time, s);
      body.object.position.set(s.x, s.y, s.z);
      body.object.rotation.y = s.yaw;
      body.pose(s.clip, s.clipTime, s.blend);
      if (s.fading) body.pose(s.fading, s.fadingTime, 1 - s.blend);
      body.apply();
    }
  }

  dispose(): void {
    for (const { body } of this.bodies) body.dispose();
  }
}
