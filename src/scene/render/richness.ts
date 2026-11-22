import type { Stage } from '../description';
import type { Season } from '../trees/builder';

/**
 * Richness stages of a painting. Each stage changes the mood (light, sky, density, life),
 * not only the number of objects; stage 0 is bare but already pretty, stage 4 is the fairy
 * finale. The relief of a stage (size, mountains, water) belongs to the terrain.
 */
export interface Ambience {
  name: string;
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
  /** Densities, as factors of the full amounts. */
  grass: number;
  flowers: number;
  bushes: number;
  mushrooms: number;
  lilies: number;
  /** Trees of the clearing itself and of the forest around it, and their ages. */
  clearingTrees: number;
  clearingAge: readonly [number, number];
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
  clouds: number;
}

export const STAGE_NAMES = ['clairière', 'verdoyant', 'fleuri', 'vivant', 'féerique'] as const;

const STAGES: Record<Stage, Ambience> = {
  // Quiet misty morning: soft light, a bare meadow with a few saplings, a pleasant start.
  0: {
    name: STAGE_NAMES[0],
    sky: { zenith: 0x8ec3ea, horizon: 0xe3f0f4, nadir: 0xcfe2ea },
    fog: { color: 0xdcecf1, near: 0.7, far: 2.0 },
    hemisphere: { sky: 0xdcecf7, ground: 0x93aa86, intensity: 1.25 },
    sun: { color: 0xfff0d8, intensity: 2.0, azimuth: -42, elevation: 40, glow: 0.35 },
    wind: 0.45,
    grass: 0.22,
    flowers: 0,
    bushes: 0.2,
    mushrooms: 0,
    lilies: 0,
    clearingTrees: 1,
    clearingAge: [0.25, 0.45],
    edgeTrees: 0.45,
    edgeAge: [0.5, 0.75],
    pollen: 0.15,
    butterflies: 0,
    fallingLeaves: 0.1,
    fireflies: 0,
    birds: 0,
    sunRays: 0,
    sparkle: 0,
    rainbow: 0,
    clouds: 0.4,
  },
  // Greener and brighter, first flowers.
  1: {
    name: STAGE_NAMES[1],
    sky: { zenith: 0x6fb7ee, horizon: 0xd4ecf8, nadir: 0xc2e0f0 },
    fog: { color: 0xcfe8f5, near: 0.8, far: 2.45 },
    hemisphere: { sky: 0xd4ebff, ground: 0x8fb873, intensity: 1.25 },
    sun: { color: 0xfff4de, intensity: 2.35, azimuth: -38, elevation: 48, glow: 0.4 },
    wind: 0.6,
    grass: 0.5,
    flowers: 0.25,
    bushes: 0.5,
    mushrooms: 0,
    lilies: 0.4,
    clearingTrees: 0.7,
    clearingAge: [0.4, 0.65],
    edgeTrees: 0.6,
    edgeAge: [0.65, 0.9],
    pollen: 0.3,
    butterflies: 0,
    fallingLeaves: 0.2,
    fireflies: 0,
    birds: 0,
    sunRays: 0,
    sparkle: 0,
    rainbow: 0,
    clouds: 0.6,
  },
  // Full bloom at midday: saturated colours, butterflies.
  2: {
    name: STAGE_NAMES[2],
    sky: { zenith: 0x4aa2ee, horizon: 0xc2e5fb, nadir: 0xb4dcf5 },
    fog: { color: 0xc4e4f8, near: 0.92, far: 2.8 },
    hemisphere: { sky: 0xcfe9ff, ground: 0x8ec46a, intensity: 1.2 },
    sun: { color: 0xfffaf0, intensity: 2.6, azimuth: -34, elevation: 56, glow: 0.45 },
    wind: 0.7,
    grass: 0.75,
    flowers: 0.9,
    bushes: 0.8,
    mushrooms: 0.3,
    lilies: 0.8,
    clearingTrees: 0.67,
    clearingAge: [0.55, 0.85],
    edgeTrees: 0.8,
    edgeAge: [0.8, 1],
    pollen: 0.6,
    butterflies: 0.7,
    fallingLeaves: 0.3,
    fireflies: 0,
    birds: 0,
    sunRays: 0,
    sparkle: 0.15,
    rainbow: 0,
    clouds: 0.8,
  },
  // Warm afternoon full of life: birds, sun rays.
  3: {
    name: STAGE_NAMES[3],
    sky: { zenith: 0x4d97e6, horizon: 0xffe8c2, nadir: 0xf3d9c0 },
    fog: { color: 0xf7e3c4, near: 0.88, far: 2.65 },
    hemisphere: { sky: 0xdde9ff, ground: 0xa3c06a, intensity: 1.15 },
    sun: { color: 0xffe2a8, intensity: 2.7, azimuth: -58, elevation: 38, glow: 0.6 },
    wind: 0.75,
    grass: 0.92,
    flowers: 1,
    bushes: 1,
    mushrooms: 1,
    lilies: 1,
    clearingTrees: 0.85,
    clearingAge: [0.75, 0.95],
    edgeTrees: 0.92,
    edgeAge: [0.93, 1],
    pollen: 0.8,
    butterflies: 1,
    fallingLeaves: 0.4,
    fireflies: 0,
    birds: 1,
    sunRays: 0.7,
    sparkle: 0.3,
    rainbow: 0,
    clouds: 0.9,
  },
  // Grand finale at golden hour: gold light, violet shade, fireflies, sparkling waterfalls
  // and a rainbow.
  4: {
    name: STAGE_NAMES[4],
    sky: { zenith: 0x5a70d2, horizon: 0xffc98f, nadir: 0xf0b094 },
    fog: { color: 0xf8c79c, near: 0.85, far: 2.8 },
    hemisphere: { sky: 0xd6dcff, ground: 0xb9c478, intensity: 1.5 },
    sun: { color: 0xffd28c, intensity: 2.5, azimuth: -64, elevation: 27, glow: 0.9 },
    wind: 0.55,
    grass: 1,
    flowers: 1.2,
    bushes: 1,
    mushrooms: 1.3,
    lilies: 1,
    clearingTrees: 1,
    clearingAge: [0.9, 1],
    edgeTrees: 1,
    edgeAge: [1, 1],
    pollen: 1,
    butterflies: 0.8,
    fallingLeaves: 0.5,
    fireflies: 1,
    birds: 0.6,
    sunRays: 1,
    sparkle: 1,
    rainbow: 1,
    clouds: 1,
  },
};

function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Ambience of a stage, adjusted for the season. */
export function ambienceFor(stage: Stage, season: Season): Ambience {
  const base = STAGES[stage];
  const a: Ambience = {
    ...base,
    sky: { ...base.sky },
    fog: { ...base.fog },
    hemisphere: { ...base.hemisphere },
    sun: { ...base.sun },
  };
  if (season === 'spring') {
    a.flowers *= 1.3;
    a.sky.horizon = mixColor(a.sky.horizon, 0xffe6f0, 0.25);
  } else if (season === 'autumn') {
    a.sun.color = mixColor(a.sun.color, 0xffb060, 0.3);
    a.hemisphere.ground = mixColor(a.hemisphere.ground, 0xc98a4a, 0.5);
    a.fog.color = mixColor(a.fog.color, 0xf3d2a8, 0.35);
    a.sky.horizon = mixColor(a.sky.horizon, 0xf8dcb4, 0.4);
    a.flowers *= 0.25;
    a.butterflies *= 0.3;
    a.fallingLeaves = Math.min(1.6, a.fallingLeaves * 3 + 0.5);
    a.mushrooms = Math.max(a.mushrooms, 0.6) * 1.3;
  } else if (season === 'winter') {
    a.sun.color = mixColor(a.sun.color, 0xf2f6ff, 0.45);
    a.sun.intensity *= 0.9;
    a.hemisphere.ground = mixColor(a.hemisphere.ground, 0xe6effa, 0.8);
    a.hemisphere.sky = mixColor(a.hemisphere.sky, 0xe4eeff, 0.5);
    a.fog.color = mixColor(a.fog.color, 0xe8f0f8, 0.6);
    a.sky.horizon = mixColor(a.sky.horizon, 0xeef4fa, 0.6);
    a.sky.zenith = mixColor(a.sky.zenith, 0x9fc0e6, 0.4);
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
