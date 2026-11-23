import { Rng } from '../core/rng';
import { ANIMAL_NAMES, type AnimalName } from './animal-catalog';
import { SLOT_COUNT } from './terrain/clearing-layout';
import { SEASONS, type Season } from './trees/builder';

export const STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Stage = (typeof STAGES)[number];
export const LAST_STAGE: Stage = 11;
/** One value per stage. */
export type PerStage<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T];

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
export const ELEMENTS_AT_STAGE: PerStage<number> = [0, 1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/**
 * Animals of the shop (#83), each open from a stage: one newcomer at a time as the meadow
 * grows, and the wolf needs its ledge (stage 10). Once open, bought in any order.
 */
export const ANIMAL_OFFERS: readonly { animal: AnimalName; stage: Stage }[] = [
  { animal: 'Deer', stage: 3 },
  { animal: 'Fox', stage: 5 },
  { animal: 'Stag', stage: 7 },
  { animal: 'Deer', stage: 8 },
  { animal: 'Wolf', stage: 10 },
];

/**
 * Stage from which the shop sells the second, third and fourth season of a painting (#82):
 * the year turns as the painting grows.
 */
export const SEASON_STAGES: readonly Stage[] = [3, 7, 10];

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
  seed: number;
  stage: Stage;
  /** Season shown, chosen by the child among `seasons`. */
  season: Season;
  /** Seasons of this painting: the one it started with, then those bought, in buying order. */
  seasons: readonly Season[];
  /** Elements placed by the child, in placing order. */
  elements: readonly PlacedElement[];
  /** Animals the child brought from the shop, in buying order. */
  animals: readonly AnimalName[];
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
export function demoAnimals(stage: Stage): AnimalName[] {
  return ANIMAL_OFFERS.filter((offer) => offer.stage <= stage).map((offer) => offer.animal);
}

/** Share of the slots filled. */
export function fillOf(description: SceneDescription): number {
  return description.elements.length / SLOT_COUNT;
}

/** A painting where the child has placed nothing yet. */
export function newPainting(seed: number, season: Season): SceneDescription {
  return { seed, stage: 0, season, seasons: [season], elements: [], animals: [] };
}

export const DEFAULT_DESCRIPTION: SceneDescription = {
  seed: 7,
  stage: 6,
  season: 'summer',
  seasons: ['summer'],
  elements: demoElements(7, DEMO_FILL[6]),
  animals: demoAnimals(6),
};

export function parseDescription(params: URLSearchParams): SceneDescription {
  const asked = params.get('season') as Season;
  const season = SEASONS.includes(asked) ? asked : DEFAULT_DESCRIPTION.season;
  const stage = Number(params.get('stage') ?? DEFAULT_DESCRIPTION.stage);
  const seed = Number(params.get('seed') ?? DEFAULT_DESCRIPTION.seed);
  const knownStage = STAGES.includes(stage as Stage) ? (stage as Stage) : DEFAULT_DESCRIPTION.stage;
  const fill = Number(params.get('fill') ?? Number.NaN);
  const knownSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : DEFAULT_DESCRIPTION.seed;
  return {
    seed: knownSeed,
    stage: knownStage,
    season,
    seasons: [season],
    elements: demoElements(
      knownSeed,
      Number.isFinite(fill) ? Math.min(1, Math.max(0, fill / 100)) : DEMO_FILL[knownStage],
    ),
    animals: demoAnimals(knownStage),
  };
}

export function writeDescription(params: URLSearchParams, description: SceneDescription): void {
  params.set('stage', String(description.stage));
  params.set('season', description.season);
  params.set('seed', String(description.seed));
  params.set('fill', String(Math.round(fillOf(description) * 100)));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a description kept in a save or the Album; null when anything is out of place
 * (unknown stage, season or animal, slot outside the painting or placed twice, more animals
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
  for (const animal of animals) {
    const offered = ANIMAL_OFFERS.filter((offer) => offer.animal === animal).length;
    if (!ANIMAL_NAMES.includes(animal as AnimalName)) return null;
    if (animals.filter((a) => a === animal).length > offered) return null;
  }
  const { seed, stage, season } = value;
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
  return {
    seed: seed as number,
    stage: stage as Stage,
    season: season as Season,
    seasons: seasons as Season[],
    elements,
    animals: animals as AnimalName[],
  };
}
