import { Rng } from '../core/rng';
import { ANIMAL_NAMES, type AnimalName } from './animal-catalog';
import { SLOT_COUNT } from './terrain/clearing-layout';
import { SEASONS, type Season } from './trees/builder';

export const STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Stage = (typeof STAGES)[number];
export const LAST_STAGE: Stage = 11;
/** One value per stage. */
export type PerStage<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T];

/**
 * Décors of a painting: the clearing, the orchard on its hills (#31), the sky islands (#32),
 * the mountain of the torrents (#136).
 */
export const BIOME_IDS = ['clearing', 'orchard', 'sky', 'mountain'] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

/** An element the child placed in a slot of the painting; its kind is the slot's. */
export interface PlacedElement {
  slot: number;
  /** Local day number of the placing, for the Album. */
  day: number;
}

/** Elements of a painting at most: one per slot. */
export const MAX_ELEMENTS = SLOT_COUNT;

/**
 * Elements placed to reach each stage (#29): one per stage at first, then two. The slots
 * open at a stage always leave at least two free to choose from (tested over many seeds).
 */
export const ELEMENTS_AT_STAGE: PerStage<number> = [0, 1, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19];

/**
 * Animals of the shop of each décor (#83), each open from a stage: one newcomer at a time as
 * the meadow grows, and the wolf needs its ledge (stage 10). Once open, bought in any order.
 */
export const ANIMAL_OFFERS: Record<BiomeId, readonly { animal: AnimalName; stage: Stage }[]> = {
  clearing: [
    { animal: 'Deer', stage: 3 },
    { animal: 'Fox', stage: 5 },
    { animal: 'Stag', stage: 7 },
    { animal: 'Deer', stage: 8 },
    { animal: 'Wolf', stage: 10 },
  ],
  orchard: [
    { animal: 'Donkey', stage: 3 },
    { animal: 'Alpaca', stage: 5 },
    { animal: 'Horse', stage: 7 },
    { animal: 'Cow', stage: 9 },
    { animal: 'Alpaca', stage: 10 },
  ],
  // Mountain animals, at home on the islands of the sky.
  sky: [
    { animal: 'Alpaca', stage: 3 },
    { animal: 'Fox', stage: 5 },
    { animal: 'Stag', stage: 7 },
    { animal: 'Alpaca', stage: 9 },
    { animal: 'Deer', stage: 10 },
  ],
  // The animals of the heights, made from the pack's (the marmots live in pairs).
  mountain: [
    { animal: 'Marmot', stage: 3 },
    { animal: 'Chamois', stage: 5 },
    { animal: 'Ibex', stage: 7 },
    { animal: 'Wolf', stage: 9 },
    { animal: 'Marmot', stage: 10 },
  ],
};

/**
 * Stage from which the shop sells the second, third and fourth season of a painting (#82):
 * the year turns as the painting grows.
 */
export const SEASON_STAGES: readonly Stage[] = [3, 7, 10];

/** Stage from which the shop sells the night of a painting (#85), announced the stage before. */
export const NIGHT_STAGE: Stage = 5;

/** The night of a painting: not bought, bought but day shown, or shown (over `season`). */
export const NIGHTS = ['none', 'owned', 'shown'] as const;
export type Night = (typeof NIGHTS)[number];

/** What the child picks in the bar of the seasons: a season, or the night, a fifth choice. */
export type SeasonChoice = Season | 'night';

/**
 * Rare elements, bought in golden seeds for the whole painting (#46): fireflies, a rainbow
 * over the widest fall, and the great element of each décor: the beavers, who fill their lake
 * in the clearing, the windmill of the orchard, the balloon of the sky islands, the eagles of
 * the mountain.
 */
export const RARE_NAMES = [
  'fireflies',
  'rainbow',
  'beavers',
  'windmill',
  'balloon',
  'cablecar',
] as const;
export type RareName = (typeof RARE_NAMES)[number];
/** The great element of each décor, the climax of the painting: dearer, shown apart in the shop. */
export const GRAND_RARES: readonly RareName[] = ['beavers', 'windmill', 'balloon', 'cablecar'];

/**
 * The rare elements of each décor, each open from a stage: the rainbow needs a fall landing
 * in water, the beavers their dry hollow, dug at 7.
 */
export const RARE_OFFERS: Record<BiomeId, readonly { rare: RareName; stage: Stage }[]> = {
  clearing: [
    { rare: 'fireflies', stage: 4 },
    { rare: 'rainbow', stage: 6 },
    { rare: 'beavers', stage: 7 },
  ],
  orchard: [
    { rare: 'fireflies', stage: 4 },
    { rare: 'rainbow', stage: 6 },
    { rare: 'windmill', stage: 8 },
  ],
  sky: [
    { rare: 'fireflies', stage: 4 },
    { rare: 'rainbow', stage: 8 },
    { rare: 'balloon', stage: 8 },
  ],
  mountain: [
    { rare: 'fireflies', stage: 4 },
    { rare: 'rainbow', stage: 6 },
    { rare: 'cablecar', stage: 8 },
  ],
};

/** Stage from which a rare element is sold in a décor, null when it has none. */
export function rareStage(biome: BiomeId, rare: RareName): Stage | null {
  return RARE_OFFERS[biome].find((offer) => offer.rare === rare)?.stage ?? null;
}

/** The season after this one, in the order of the year. */
export function nextSeason(season: Season): Season {
  return SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
}

/** Stage of a painting with this many elements placed. */
export function stageFor(elements: number): Stage {
  let stage = 0;
  while (stage < LAST_STAGE && elements >= ELEMENTS_AT_STAGE[stage + 1]) stage++;
  return stage as Stage;
}

/**
 * Everything needed to rebuild a scene identically, for the game and the Album: the
 * painting is a pure function of this description (and of the growth triggered on top).
 */
export interface SceneDescription {
  biome: BiomeId;
  seed: number;
  stage: Stage;
  /** Season shown, chosen by the child among `seasons`. */
  season: Season;
  /** Seasons of this painting: the one it started with, then those bought, in buying order. */
  seasons: readonly Season[];
  /** The night keeps the plants of `season` and changes only the light, the life and the sound. */
  night: Night;
  /** Elements placed by the child, in placing order. */
  elements: readonly PlacedElement[];
  /** Animals the child brought from the shop, in buying order. */
  animals: readonly AnimalName[];
  /** Rare elements bought for the painting, in buying order. */
  rares: readonly RareName[];
}

/** Share of the slots filled by default at each stage, as if the child had played. */
export const DEMO_FILL: PerStage<number> = [
  0.2, 0.3, 0.33, 0.36, 0.4, 0.45, 0.55, 0.6, 0.7, 0.75, 0.9, 1,
];

/**
 * Elements of a demonstration scene (`?fill=`, debug panel, captures): a share of all the
 * slots, mostly the first ones to open. A filled slot stays filled with a larger share.
 */
export function demoElements(seed: number, fill: number): PlacedElement[] {
  const rng = new Rng(seed).fork('fill');
  const order = Array.from({ length: SLOT_COUNT }, (_, i) => ({ i, key: i + rng.range(0, 3) }));
  order.sort((a, b) => a.key - b.key);
  return order.slice(0, Math.round(fill * SLOT_COUNT)).map((o) => ({ slot: o.i, day: 0 }));
}

/** Animals of a demonstration scene: every one open at its stage, as if the child had bought them. */
export function demoAnimals(biome: BiomeId, stage: Stage): AnimalName[] {
  return ANIMAL_OFFERS[biome].filter((offer) => offer.stage <= stage).map((offer) => offer.animal);
}

/** Rare elements of a demonstration scene: every one open at its stage. */
export function demoRares(biome: BiomeId, stage: Stage): RareName[] {
  return RARE_OFFERS[biome].filter((offer) => offer.stage <= stage).map((offer) => offer.rare);
}

/** Share of the slots filled. */
export function fillOf(description: SceneDescription): number {
  return description.elements.length / SLOT_COUNT;
}

/** Every slot is filled: the grand finale, then the Album (#33). */
export function isComplete(description: SceneDescription): boolean {
  return description.elements.length >= MAX_ELEMENTS;
}

/** What a new painting will look like once complete, with every animal and rare element. */
export function completed(description: SceneDescription): SceneDescription {
  return {
    ...description,
    stage: LAST_STAGE,
    elements: demoElements(description.seed, 1),
    animals: demoAnimals(description.biome, LAST_STAGE),
    rares: demoRares(description.biome, LAST_STAGE),
  };
}

/** A painting where the child has placed nothing yet. */
export function newPainting(seed: number, season: Season, biome: BiomeId): SceneDescription {
  return {
    biome,
    seed,
    stage: 0,
    season,
    seasons: [season],
    night: 'none',
    elements: [],
    animals: [],
    rares: [],
  };
}

/** What the bar of the seasons shows ringed. */
export function shownChoice(description: SceneDescription): SeasonChoice {
  return description.night === 'shown' ? 'night' : description.season;
}

/** What the bar of the seasons offers: the seasons of the painting in the order of the year, then the night. */
export function choicesOf(description: SceneDescription): SeasonChoice[] {
  const choices: SeasonChoice[] = SEASONS.filter((s) => description.seasons.includes(s));
  if (description.night !== 'none') choices.push('night');
  return choices;
}

/**
 * The painting with a season or the night shown, bought if it was not yet: leaving the night
 * shows the season picked, with its plants.
 */
export function choose(description: SceneDescription, choice: SeasonChoice): SceneDescription {
  if (choice === 'night') return { ...description, night: 'shown' };
  const { seasons } = description;
  return {
    ...description,
    season: choice,
    seasons: seasons.includes(choice) ? seasons : [...seasons, choice],
    night: description.night === 'none' ? 'none' : 'owned',
  };
}

/** The painting has it already; the shop sells the others. */
export function isBought(description: SceneDescription, choice: SeasonChoice): boolean {
  return choice === 'night' ? description.night !== 'none' : description.seasons.includes(choice);
}

export const DEFAULT_DESCRIPTION: SceneDescription = {
  biome: 'clearing',
  seed: 7,
  stage: 6,
  season: 'summer',
  seasons: ['summer'],
  night: 'none',
  elements: demoElements(7, DEMO_FILL[6]),
  animals: demoAnimals('clearing', 6),
  rares: demoRares('clearing', 6),
};

export function parseDescription(params: URLSearchParams): SceneDescription {
  const asked = params.get('season') as Season;
  const season = SEASONS.includes(asked) ? asked : DEFAULT_DESCRIPTION.season;
  const stage = Number(params.get('stage') ?? DEFAULT_DESCRIPTION.stage);
  const seed = Number(params.get('seed') ?? DEFAULT_DESCRIPTION.seed);
  const knownStage = STAGES.includes(stage as Stage) ? (stage as Stage) : DEFAULT_DESCRIPTION.stage;
  const fill = Number(params.get('fill') ?? Number.NaN);
  const knownSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : DEFAULT_DESCRIPTION.seed;
  const biome = params.get('biome');
  const knownBiome = BIOME_IDS.includes(biome as BiomeId)
    ? (biome as BiomeId)
    : DEFAULT_DESCRIPTION.biome;
  return {
    biome: knownBiome,
    seed: knownSeed,
    stage: knownStage,
    season,
    seasons: [season],
    // `?night`: the painting at night, for the captures.
    night: params.has('night') ? 'shown' : 'none',
    elements: demoElements(
      knownSeed,
      Number.isFinite(fill) ? Math.min(1, Math.max(0, fill / 100)) : DEMO_FILL[knownStage],
    ),
    animals: demoAnimals(knownBiome, knownStage),
    rares: params.has('rares')
      ? askedRares(knownBiome, params.get('rares')!)
      : demoRares(knownBiome, knownStage),
  };
}

/** `?rares=beavers,rainbow` (captures): those of the décor, each once; empty for none. */
function askedRares(biome: BiomeId, asked: string): RareName[] {
  const names = new Set(asked.split(','));
  return RARE_OFFERS[biome].map((offer) => offer.rare).filter((rare) => names.has(rare));
}

export function writeDescription(params: URLSearchParams, description: SceneDescription): void {
  params.set('biome', description.biome);
  params.set('stage', String(description.stage));
  params.set('season', description.season);
  if (description.night === 'shown') params.set('night', '');
  else params.delete('night');
  params.set('seed', String(description.seed));
  params.set('fill', String(Math.round(fillOf(description) * 100)));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a description kept in a save or the Album; null when anything is out of place
 * (unknown stage, season, night or animal, slot outside the painting or placed twice, more animals
 * of a kind than the shop offers, season shown but not owned or owned twice).
 */
export function readDescription(value: unknown): SceneDescription | null {
  if (
    !isObject(value) ||
    !Array.isArray(value.elements) ||
    !Array.isArray(value.animals) ||
    !Array.isArray(value.seasons)
  ) {
    return null;
  }
  const seasons = value.seasons as unknown[];
  if (
    !seasons.every((s) => SEASONS.includes(s as Season)) ||
    new Set(seasons).size !== seasons.length ||
    !seasons.includes(value.season)
  ) {
    return null;
  }
  const animals = value.animals as unknown[];
  const { biome, seed, stage, season, night } = value;
  if (!BIOME_IDS.includes(biome as BiomeId) || !NIGHTS.includes(night as Night)) return null;
  for (const animal of animals) {
    const offered = ANIMAL_OFFERS[biome as BiomeId].filter((o) => o.animal === animal).length;
    if (!ANIMAL_NAMES.includes(animal as AnimalName)) return null;
    if (animals.filter((a) => a === animal).length > offered) return null;
  }
  const slots = new Set<number>();
  const elements: PlacedElement[] = [];
  for (const element of value.elements as unknown[]) {
    if (!isObject(element)) return null;
    const { slot, day } = element;
    if (!Number.isInteger(slot) || !Number.isInteger(day)) return null;
    if ((slot as number) < 0 || (slot as number) >= MAX_ELEMENTS || slots.has(slot as number)) {
      return null;
    }
    slots.add(slot as number);
    elements.push({ slot: slot as number, day: day as number });
  }
  if (!Number.isInteger(seed) || (seed as number) < 0 || !STAGES.includes(stage as Stage)) {
    return null;
  }
  // Paintings described before the rare elements (#46) have none.
  const rares = readRares(biome as BiomeId, value.rares ?? []);
  if (!rares) return null;
  return {
    biome: biome as BiomeId,
    seed: seed as number,
    stage: stage as Stage,
    season: season as Season,
    seasons: seasons as Season[],
    night: night as Night,
    elements,
    animals: animals as AnimalName[],
    rares,
  };
}

/** Rare elements of a décor, each bought once; null when anything is out of place. */
function readRares(biome: BiomeId, value: unknown): RareName[] | null {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return null;
  const rares = value as RareName[];
  return rares.every((rare) => rareStage(biome, rare) !== null) ? rares : null;
}
