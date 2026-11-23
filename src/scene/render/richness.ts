import type { AnimalName } from '../animal-catalog';
import type { PerStage, Stage } from '../description';
import type { Season } from '../trees/builder';

/** Light and sky of a painting. */
interface Light {
  sky: { zenith: number; horizon: number; nadir: number };
  /** Fog start and end, as factors of the distance from the camera to the diorama. */
  fog: { color: number; near: number; far: number };
  hemisphere: { sky: number; ground: number; intensity: number };
  sun: {
    color: number;
    intensity: number;
    /** Direction to the sun: azimuth from +z towards +x, elevation above the horizon (degrees). */
    azimuth: number;
    elevation: number;
    /** Glow of the sun in the sky. */
    glow: number;
  };
  wind: number;
  clouds: number;
}

/**
 * Richness of a painting at a stage. Each stage changes the mood (light, sky, density,
 * life), not only the number of objects; the first stage is bare but already pretty, the
 * last one is the fairy finale. The relief of a stage (size, mountains, water) belongs to
 * the terrain.
 */
export interface Ambience extends Light {
  name: string;
  /** Densities, as factors of the full amounts. */
  grass: number;
  flowers: number;
  bushes: number;
  mushrooms: number;
  lilies: number;
  /** Fallen logs and stumps along the forest edge and in the meadow. */
  deadwood: number;
  /** Ages of the trees of the slots and of the forest around the clearing. */
  clearingAge: readonly [number, number];
  edgeTrees: number;
  edgeAge: readonly [number, number];
  /** Ambient life. */
  pollen: number;
  butterflies: number;
  fallingLeaves: number;
  fireflies: number;
  birds: number;
  /** Number of each animal wandering in the meadow. */
  animals: Record<AnimalName, number>;
  sunRays: number;
  /** Glints on the water and sparkles around the waterfall. */
  sparkle: number;
  /** Rainbow over the main waterfall. */
  rainbow: number;
  /** Volume of each layer of the soundscape (0 = silent). */
  sound: SoundLevels;
}

/** Layers of the ambient sound, synthesised by `src/scene/audio/`. */
export interface SoundLevels {
  /** Soft wind in the trees. */
  wind: number;
  /** Water heard from afar: the spring, then the falls. */
  water: number;
}

/** What each stage brings, in a word or two. */
export const STAGE_NAMES: PerStage<string> = [
  'prairie',
  'premières fleurs',
  'cascade',
  'ruisseau',
  'montagne',
  'confluent',
  'neiges',
  'grande cascade',
  'oiseaux',
  'trois ruisseaux',
  'doré',
  'féerique',
];

// The day goes by as the painting gets richer: five moods, and the light of a stage slides
// from one to the next.
const MOODS: readonly Light[] = [
  // Quiet misty morning: soft light.
  {
    sky: { zenith: 0x8ec3ea, horizon: 0xe3f0f4, nadir: 0xcfe2ea },
    fog: { color: 0xdcecf1, near: 0.7, far: 2.0 },
    hemisphere: { sky: 0xdcecf7, ground: 0x93aa86, intensity: 1.25 },
    sun: { color: 0xfff0d8, intensity: 2.0, azimuth: -42, elevation: 40, glow: 0.35 },
    wind: 0.45,
    clouds: 0.4,
  },
  // Clear morning: greener and brighter.
  {
    sky: { zenith: 0x6fb7ee, horizon: 0xd4ecf8, nadir: 0xc2e0f0 },
    fog: { color: 0xcfe8f5, near: 0.8, far: 2.45 },
    hemisphere: { sky: 0xd4ebff, ground: 0x8fb873, intensity: 1.25 },
    sun: { color: 0xfff4de, intensity: 2.35, azimuth: -38, elevation: 48, glow: 0.4 },
    wind: 0.6,
    clouds: 0.6,
  },
  // Midday: saturated colours.
  {
    sky: { zenith: 0x4aa2ee, horizon: 0xc2e5fb, nadir: 0xb4dcf5 },
    fog: { color: 0xc4e4f8, near: 0.92, far: 2.8 },
    hemisphere: { sky: 0xcfe9ff, ground: 0x8ec46a, intensity: 1.2 },
    sun: { color: 0xfffaf0, intensity: 2.6, azimuth: -34, elevation: 56, glow: 0.45 },
    wind: 0.7,
    clouds: 0.8,
  },
  // Warm afternoon.
  {
    sky: { zenith: 0x4d97e6, horizon: 0xffe8c2, nadir: 0xf3d9c0 },
    fog: { color: 0xf7e3c4, near: 0.88, far: 2.65 },
    hemisphere: { sky: 0xdde9ff, ground: 0xa3c06a, intensity: 1.15 },
    sun: { color: 0xffe2a8, intensity: 2.7, azimuth: -58, elevation: 38, glow: 0.6 },
    wind: 0.75,
    clouds: 0.9,
  },
  // Golden hour: gold light, violet shade.
  {
    sky: { zenith: 0x5a70d2, horizon: 0xffc98f, nadir: 0xf0b094 },
    fog: { color: 0xf8c79c, near: 0.85, far: 2.8 },
    hemisphere: { sky: 0xd6dcff, ground: 0xb9c478, intensity: 1.5 },
    sun: { color: 0xffd28c, intensity: 2.5, azimuth: -64, elevation: 27, glow: 0.9 },
    wind: 0.55,
    clouds: 1,
  },
];

/** Position of each stage among the moods: stages 0, 3, 6, 9 and 11 show one exactly. */
const MOOD_AT: PerStage<number> = [0, 0.35, 0.7, 1, 1.35, 1.7, 2, 2.35, 2.7, 3, 3.5, 4];

// One value per stage, so each line reads as a progression. Most stages bring one new kind
// of life: flowers (1), water lilies (2), a doe (3), butterflies, mushrooms and a fox (5),
// a stag (7), birds (8), sun rays and sparkling falls (9), fireflies and a wolf (10),
// rainbow and fairy ring (11).
const LIFE = {
  grass: [0.22, 0.3, 0.38, 0.5, 0.58, 0.67, 0.75, 0.8, 0.86, 0.92, 0.96, 1],
  flowers: [0, 0.1, 0.18, 0.25, 0.45, 0.7, 0.9, 0.95, 1, 1, 1.1, 1.2],
  bushes: [0.2, 0.28, 0.38, 0.5, 0.6, 0.7, 0.8, 0.86, 0.93, 1, 1, 1],
  mushrooms: [0, 0, 0, 0, 0, 0.15, 0.3, 0.5, 0.75, 1, 1.15, 1.3],
  lilies: [0, 0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.87, 0.94, 1, 1, 1],
  deadwood: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
  clearingAgeMin: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.62, 0.68, 0.75, 0.82, 0.9],
  clearingAgeMax: [0.45, 0.5, 0.58, 0.65, 0.72, 0.78, 0.85, 0.88, 0.92, 0.95, 0.98, 1],
  edgeTrees: [0.45, 0.5, 0.55, 0.6, 0.66, 0.73, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  edgeAgeMin: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.93, 0.97, 1],
  edgeAgeMax: [0.75, 0.8, 0.85, 0.9, 0.93, 0.97, 1, 1, 1, 1, 1, 1],
  pollen: [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.67, 0.74, 0.8, 0.9, 1],
  butterflies: [0, 0, 0, 0, 0, 0.35, 0.7, 0.8, 0.9, 1, 0.9, 0.8],
  fallingLeaves: [0.1, 0.13, 0.17, 0.2, 0.23, 0.27, 0.3, 0.33, 0.37, 0.4, 0.45, 0.5],
  fireflies: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1],
  birds: [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0.8, 0.6],
  deer: [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2],
  fox: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  stag: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  wolf: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  sunRays: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.85, 1],
  sparkle: [0, 0, 0, 0, 0, 0.08, 0.15, 0.2, 0.25, 0.3, 0.6, 1],
  rainbow: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  windSound: [0.7, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.8, 0.8, 0.8, 0.75, 0.7],
  waterSound: [0.35, 0.38, 0.5, 0.58, 0.62, 0.68, 0.72, 0.8, 0.84, 0.9, 0.95, 1],
} satisfies Record<string, PerStage<number>>;

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

function lightOf(stage: Stage): Light {
  const at = MOOD_AT[stage];
  const index = Math.min(MOODS.length - 2, Math.floor(at));
  const a = MOODS[index];
  const b = MOODS[index + 1];
  const t = at - index;
  return {
    sky: {
      zenith: mixColor(a.sky.zenith, b.sky.zenith, t),
      horizon: mixColor(a.sky.horizon, b.sky.horizon, t),
      nadir: mixColor(a.sky.nadir, b.sky.nadir, t),
    },
    fog: {
      color: mixColor(a.fog.color, b.fog.color, t),
      near: mix(a.fog.near, b.fog.near, t),
      far: mix(a.fog.far, b.fog.far, t),
    },
    hemisphere: {
      sky: mixColor(a.hemisphere.sky, b.hemisphere.sky, t),
      ground: mixColor(a.hemisphere.ground, b.hemisphere.ground, t),
      intensity: mix(a.hemisphere.intensity, b.hemisphere.intensity, t),
    },
    sun: {
      color: mixColor(a.sun.color, b.sun.color, t),
      intensity: mix(a.sun.intensity, b.sun.intensity, t),
      azimuth: mix(a.sun.azimuth, b.sun.azimuth, t),
      elevation: mix(a.sun.elevation, b.sun.elevation, t),
      glow: mix(a.sun.glow, b.sun.glow, t),
    },
    wind: mix(a.wind, b.wind, t),
    clouds: mix(a.clouds, b.clouds, t),
  };
}

/** Pull of a season on one colour of the stage light: target colour and amount (0 to 1). */
type Tint = readonly [color: number, amount: number];

interface SeasonLight {
  zenith?: Tint;
  horizon?: Tint;
  nadir?: Tint;
  fog?: Tint;
  hemisphereSky?: Tint;
  hemisphereGround?: Tint;
  sun?: Tint;
  sunIntensity?: number;
}

// Each season pulls the light of the stage towards its own colours: the golden finale stays
// golden in autumn, turns pink and lilac over the snow in winter. Summer keeps the stage light.
const SEASON_LIGHT: Record<Season, SeasonLight> = {
  spring: {
    zenith: [0x7cc4f0, 0.15],
    horizon: [0xffe6f0, 0.3],
    hemisphereGround: [0x9ad07a, 0.25],
    sun: [0xfffaf0, 0.2],
  },
  summer: {},
  autumn: {
    horizon: [0xf8dcb4, 0.4],
    fog: [0xf3d2a8, 0.35],
    hemisphereGround: [0xc98a4a, 0.5],
    sun: [0xffb060, 0.3],
  },
  winter: {
    zenith: [0x7f9fe0, 0.55],
    horizon: [0xf1dcef, 0.65],
    nadir: [0xdfe3f3, 0.65],
    fog: [0xe3e6f5, 0.7],
    hemisphereSky: [0xc9dcff, 0.6],
    hemisphereGround: [0xe6effa, 0.8],
    sun: [0xfff0f0, 0.6],
    sunIntensity: 0.9,
  },
};

function tint(color: number, pull: Tint | undefined): number {
  return pull ? mixColor(color, pull[0], pull[1]) : color;
}

/** Ambience of a stage, adjusted for the season. */
export function ambienceFor(stage: Stage, season: Season): Ambience {
  const light = lightOf(stage);
  const s = SEASON_LIGHT[season];
  light.sky.zenith = tint(light.sky.zenith, s.zenith);
  light.sky.horizon = tint(light.sky.horizon, s.horizon);
  light.sky.nadir = tint(light.sky.nadir, s.nadir);
  light.fog.color = tint(light.fog.color, s.fog);
  light.hemisphere.sky = tint(light.hemisphere.sky, s.hemisphereSky);
  light.hemisphere.ground = tint(light.hemisphere.ground, s.hemisphereGround);
  light.sun.color = tint(light.sun.color, s.sun);
  light.sun.intensity *= s.sunIntensity ?? 1;
  const a: Ambience = {
    ...light,
    name: STAGE_NAMES[stage],
    grass: LIFE.grass[stage],
    flowers: LIFE.flowers[stage],
    bushes: LIFE.bushes[stage],
    mushrooms: LIFE.mushrooms[stage],
    lilies: LIFE.lilies[stage],
    deadwood: LIFE.deadwood[stage],
    clearingAge: [LIFE.clearingAgeMin[stage], LIFE.clearingAgeMax[stage]],
    edgeTrees: LIFE.edgeTrees[stage],
    edgeAge: [LIFE.edgeAgeMin[stage], LIFE.edgeAgeMax[stage]],
    pollen: LIFE.pollen[stage],
    butterflies: LIFE.butterflies[stage],
    fallingLeaves: LIFE.fallingLeaves[stage],
    fireflies: LIFE.fireflies[stage],
    birds: LIFE.birds[stage],
    animals: {
      Deer: LIFE.deer[stage],
      Fox: LIFE.fox[stage],
      Stag: LIFE.stag[stage],
      Wolf: LIFE.wolf[stage],
    },
    sunRays: LIFE.sunRays[stage],
    sparkle: LIFE.sparkle[stage],
    rainbow: LIFE.rainbow[stage],
    sound: { wind: LIFE.windSound[stage], water: LIFE.waterSound[stage] },
  };
  if (season === 'spring') {
    a.flowers *= 1.3;
  } else if (season === 'autumn') {
    a.flowers *= 0.25;
    a.butterflies *= 0.3;
    a.fallingLeaves = Math.min(1.6, a.fallingLeaves * 3 + 0.5);
    a.mushrooms = Math.max(a.mushrooms, 0.6) * 1.3;
  } else if (season === 'winter') {
    a.grass *= 0.3;
    a.flowers = 0;
    a.butterflies = 0;
    a.fallingLeaves = 0;
    a.mushrooms = 0;
    a.lilies = 0;
    // Snowflakes replace the pollen.
    a.pollen = 0.5 + 0.5 * a.pollen;
  }
  return a;
}
