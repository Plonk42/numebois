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
  /** The night (#85): moon instead of sun, stars in the sky. */
  night: boolean;
  /** Densities, as factors of the full amounts. */
  grass: number;
  flowers: number;
  bushes: number;
  mushrooms: number;
  lilies: number;
  /** Fallen logs and stumps along the forest edge and in the meadow. */
  deadwood: number;
  /** Trees of the forest around the clearing, and their ages. */
  edgeTrees: number;
  edgeAge: readonly [number, number];
  /** Ambient life. */
  pollen: number;
  butterflies: number;
  fallingLeaves: number;
  fireflies: number;
  birds: number;
  sunRays: number;
  /** Glints on the water and sparkles around the waterfall. */
  sparkle: number;
  /** Rainbow over the main waterfall. */
  rainbow: number;
  /** Layers of the soundscape: volumes of the loops, rates of the calls. */
  sound: SoundLevels;
}

/** Layers of the ambient sound (`src/scene/audio/`): the wind is synthesised, the rest recorded. */
export interface SoundLevels {
  /** Volumes of the loops (0 = silent). */
  wind: number;
  pond: number;
  brook: number;
  falls: number;
  birds: number;
  chorus: number;
  meadow: number;
  leaves: number;
  crickets: number;
  /** Calls a minute, at random moments: songbirds, woodpecker, cuckoo, tawny owl, chimes. */
  songs: number;
  woodpecker: number;
  cuckoo: number;
  owl: number;
  magic: number;
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
  'lac des castors',
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
// of life: flowers (1), water lilies (2), butterflies and mushrooms (5), birds (8), sun rays
// and sparkling falls (9), fireflies (10), rainbow and fairy ring (11). The animals come from
// the shop, from the stages of `ANIMAL_OFFERS` (doe 3, fox 5, stag 7, wolf 10). These are the
// clearing's; another décor replaces the columns it needs (`BiomeLook`).
const LIFE_TABLE = {
  grass: [0.22, 0.3, 0.38, 0.5, 0.58, 0.67, 0.75, 0.8, 0.86, 0.92, 0.96, 1],
  flowers: [0, 0.1, 0.18, 0.25, 0.45, 0.7, 0.9, 0.95, 1, 1, 1.1, 1.2],
  bushes: [0.2, 0.28, 0.38, 0.5, 0.6, 0.7, 0.8, 0.86, 0.93, 1, 1, 1],
  mushrooms: [0, 0, 0, 0, 0, 0.15, 0.3, 0.5, 0.75, 1, 1.15, 1.3],
  lilies: [0, 0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.87, 0.94, 1, 1, 1],
  deadwood: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
  edgeTrees: [0.45, 0.5, 0.55, 0.6, 0.66, 0.73, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  edgeAgeMin: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.93, 0.97, 1],
  edgeAgeMax: [0.75, 0.8, 0.85, 0.9, 0.93, 0.97, 1, 1, 1, 1, 1, 1],
  pollen: [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.67, 0.74, 0.8, 0.9, 1],
  butterflies: [0, 0, 0, 0, 0, 0.35, 0.7, 0.8, 0.9, 1, 0.9, 0.8],
  fallingLeaves: [0.1, 0.13, 0.17, 0.2, 0.23, 0.27, 0.3, 0.33, 0.37, 0.4, 0.45, 0.5],
  fireflies: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1],
  birds: [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0.8, 0.6],
  sunRays: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.85, 1],
  sparkle: [0, 0, 0, 0, 0, 0.08, 0.15, 0.2, 0.25, 0.3, 0.6, 1],
  rainbow: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  // Sound, one new layer at stages 0, 2, 3, 6, 9 and 11: the spring's pond, the falls, the
  // stream and the first birds, a livelier chorus and the meadow's insects, woodpecker,
  // cuckoo and leaves in the gusts, then crickets, tawny owl and chimes. As layers come, the
  // older ones step back, so the whole stays about as loud (and families take turns, #8).
  windSound: [0.7, 0.7, 0.68, 0.62, 0.6, 0.58, 0.52, 0.5, 0.48, 0.45, 0.42, 0.4],
  pondSound: [0.5, 0.5, 0.42, 0.32, 0.3, 0.28, 0.24, 0.22, 0.2, 0.18, 0.18, 0.15],
  fallsSound: [0, 0, 0.3, 0.32, 0.35, 0.38, 0.38, 0.42, 0.42, 0.42, 0.42, 0.4],
  brookSound: [0, 0, 0, 0.3, 0.32, 0.34, 0.34, 0.34, 0.36, 0.36, 0.36, 0.34],
  birdsSound: [0, 0, 0, 0.45, 0.48, 0.5, 0.42, 0.42, 0.45, 0.38, 0.38, 0.32],
  songs: [0, 0, 0, 1.5, 2, 2.5, 3, 3, 3.5, 3, 2.5, 2],
  chorusSound: [0, 0, 0, 0, 0, 0, 0.22, 0.25, 0.3, 0.24, 0.22, 0.15],
  meadowSound: [0, 0, 0, 0, 0, 0, 0.4, 0.4, 0.42, 0.32, 0.32, 0.28],
  woodpecker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.5, 0.4],
  cuckoo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.5, 0.3],
  leavesSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0.25],
  cricketsSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35],
  owl: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  magic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
} satisfies Record<string, PerStage<number>>;

export type LifeColumn = keyof typeof LIFE_TABLE;

/** What a décor changes to the shared ambience: names, life and sound, a tint of the light. */
export interface BiomeLook {
  stageNames: PerStage<string>;
  /** Columns of life and sound replaced for this décor. */
  life?: Partial<Record<LifeColumn, PerStage<number>>>;
  light?: SeasonLight;
}

const CLEARING_LOOK: BiomeLook = { stageNames: STAGE_NAMES };

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

export interface SeasonLight {
  zenith?: Tint;
  horizon?: Tint;
  nadir?: Tint;
  fog?: Tint;
  hemisphereSky?: Tint;
  hemisphereGround?: Tint;
  sun?: Tint;
  sunIntensity?: number;
  hemisphereIntensity?: number;
}

// Each season pulls the light of the stage towards its own colours: the golden finale stays
// golden in autumn, turns pink and lilac over the snow in winter. Spring is fresh and pastel,
// summer warm and deep.
const SEASON_LIGHT: Record<Season, SeasonLight> = {
  spring: {
    zenith: [0x8fd0f5, 0.3],
    horizon: [0xffe3f0, 0.45],
    fog: [0xf4eaf4, 0.3],
    hemisphereSky: [0xf2f6ff, 0.3],
    hemisphereGround: [0xb8e08a, 0.35],
    sun: [0xfffaf4, 0.35],
  },
  summer: {
    zenith: [0x3f8ee0, 0.2],
    horizon: [0xfff0c8, 0.25],
    hemisphereGround: [0x6fa040, 0.3],
    sun: [0xffe2a8, 0.3],
    sunIntensity: 1.08,
  },
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

// The night (#85) pulls the light of the stage and its season to a cartoon moonlight: a deep
// blue sky, a blue shade still light enough to read the painting, a silver moon. A little of
// the season stays (the snow, the gold of the last stage).
const NIGHT_LIGHT: SeasonLight = {
  zenith: [0x0c1640, 0.92],
  horizon: [0x3a4c88, 0.85],
  nadir: [0x263463, 0.88],
  fog: [0x2b3a6e, 0.85],
  hemisphereSky: [0x6f86d4, 0.85],
  hemisphereGround: [0x283358, 0.85],
  sun: [0xcad8ff, 0.85],
  sunIntensity: 0.45,
  hemisphereIntensity: 0.72,
};
/** Fireflies at night, whatever the stage (outside winter). */
const NIGHT_FIREFLIES = 0.7;

/** Ambience of a stage, adjusted for the décor, the season and the night. */
export function ambienceFor(
  stage: Stage,
  season: Season,
  look: BiomeLook = CLEARING_LOOK,
  night = false,
): Ambience {
  const light = lightOf(stage);
  const pulls = [look.light, SEASON_LIGHT[season], night ? NIGHT_LIGHT : undefined];
  for (const s of pulls.filter((pull) => pull !== undefined)) {
    light.sky.zenith = tint(light.sky.zenith, s.zenith);
    light.sky.horizon = tint(light.sky.horizon, s.horizon);
    light.sky.nadir = tint(light.sky.nadir, s.nadir);
    light.fog.color = tint(light.fog.color, s.fog);
    light.hemisphere.sky = tint(light.hemisphere.sky, s.hemisphereSky);
    light.hemisphere.ground = tint(light.hemisphere.ground, s.hemisphereGround);
    light.hemisphere.intensity *= s.hemisphereIntensity ?? 1;
    light.sun.color = tint(light.sun.color, s.sun);
    light.sun.intensity *= s.sunIntensity ?? 1;
  }
  const LIFE = { ...LIFE_TABLE, ...look.life };
  const a: Ambience = {
    ...light,
    name: look.stageNames[stage],
    night,
    grass: LIFE.grass[stage],
    flowers: LIFE.flowers[stage],
    bushes: LIFE.bushes[stage],
    mushrooms: LIFE.mushrooms[stage],
    lilies: LIFE.lilies[stage],
    deadwood: LIFE.deadwood[stage],
    edgeTrees: LIFE.edgeTrees[stage],
    edgeAge: [LIFE.edgeAgeMin[stage], LIFE.edgeAgeMax[stage]],
    pollen: LIFE.pollen[stage],
    butterflies: LIFE.butterflies[stage],
    fallingLeaves: LIFE.fallingLeaves[stage],
    fireflies: LIFE.fireflies[stage],
    birds: LIFE.birds[stage],
    sunRays: LIFE.sunRays[stage],
    sparkle: LIFE.sparkle[stage],
    rainbow: LIFE.rainbow[stage],
    sound: {
      wind: LIFE.windSound[stage],
      pond: LIFE.pondSound[stage],
      brook: LIFE.brookSound[stage],
      falls: LIFE.fallsSound[stage],
      birds: LIFE.birdsSound[stage],
      chorus: LIFE.chorusSound[stage],
      meadow: LIFE.meadowSound[stage],
      leaves: LIFE.leavesSound[stage],
      crickets: LIFE.cricketsSound[stage],
      songs: LIFE.songs[stage],
      woodpecker: LIFE.woodpecker[stage],
      cuckoo: LIFE.cuckoo[stage],
      owl: LIFE.owl[stage],
      magic: LIFE.magic[stage],
    },
  };
  const sound = a.sound;
  if (season === 'spring') {
    a.flowers *= 1.5;
    // Petals drift down from the blossoming trees.
    a.fallingLeaves = Math.min(1.2, a.fallingLeaves * 2 + 0.3);
    sound.songs *= 1.3;
    sound.cuckoo *= 1.5;
  } else if (season === 'summer') {
    a.butterflies *= 1.4;
    a.fallingLeaves *= 0.4;
  } else if (season === 'autumn') {
    a.flowers *= 0.25;
    a.butterflies *= 0.3;
    a.fallingLeaves = Math.min(1.6, a.fallingLeaves * 3 + 0.5);
    a.mushrooms = Math.max(a.mushrooms, 0.6) * 1.3;
    // The cuckoo has flown south; fewer songs and insects.
    sound.cuckoo = 0;
    sound.songs *= 0.6;
    sound.chorus *= 0.6;
    sound.meadow *= 0.4;
  } else if (season === 'winter') {
    a.grass *= 0.3;
    a.flowers = 0;
    a.butterflies = 0;
    a.fallingLeaves = 0;
    a.mushrooms = 0;
    a.lilies = 0;
    // Snowflakes replace the pollen.
    a.pollen = 0.5 + 0.5 * a.pollen;
    // No insects, no cuckoo; a few birds stay.
    sound.meadow = 0;
    sound.crickets = 0;
    sound.cuckoo = 0;
    sound.songs *= 0.3;
    sound.chorus *= 0.3;
    sound.birds *= 0.5;
    sound.leaves *= 0.6;
  }
  if (night) {
    // Only the life and the sound change: the plants (densities) stay as by day.
    a.wind *= 0.6;
    a.sun.glow = 0.5;
    a.butterflies = 0;
    a.birds = 0;
    a.sunRays = 0;
    a.rainbow = 0;
    if (season !== 'winter') {
      a.pollen *= 0.3;
      a.fireflies = Math.max(a.fireflies, NIGHT_FIREFLIES);
    }
    // The birds sleep: crickets, the tawny owl and the water.
    sound.wind *= 0.8;
    sound.birds = 0;
    sound.chorus = 0;
    sound.meadow = 0;
    sound.songs = 0;
    sound.woodpecker = 0;
    sound.cuckoo = 0;
    sound.owl = Math.max(sound.owl, 1);
    if (season !== 'winter') sound.crickets = Math.max(sound.crickets, 0.35);
  }
  return a;
}
