/** Economy of the game (plan, « Boucle de progression »): the only place to tune it (#29). */

/**
 * Leaves earned by a right answer in a trail; in a drill, by a fact not known by heart yet, once
 * a day (#125); in a challenge, an acorn instead.
 */
export const LEAVES_PER_RIGHT_ANSWER = 1;
/** Leaves of a right answer at the notion's record, in the trail: the effort pays (#141). */
export const LEAVES_AT_RECORD = 2;
/** Golden seeds earned by a notion acquired, a fact automated or a level reached (#141). */
export const SEEDS_PER_ACHIEVEMENT = 1;
/** Golden seeds of the squirrel's gift, at the first challenge of the day (#126). */
export const SEEDS_PER_CHALLENGE = 1;
/** Leaves the squirrel gives for each of its acorns, at the first challenge of the day (#120). */
export const LEAVES_PER_ACORN = 1;
/** Leaves added by a flash bonus won in the trail. */
export const LEAVES_PER_FLASH = 1;
/** Leaves the drill gives in a day at most, all branches together (#29). */
export const DRILL_LEAVES_PER_DAY = 10;
/** Leaves of a new element in the shop of the forest (#83), at the first stage. */
export const LEAVES_PER_ELEMENT = 6;

/**
 * The price of a new element rises with the stages, one leaf every two: 1 or 2 elements per
 * trail, a painting in about 40 minutes (#141, #29; `tests/unit/economy.test.ts`).
 */
export function leavesPerElement(stage: number): number {
  return LEAVES_PER_ELEMENT + Math.floor(stage / 2);
}
/** Golden seeds of an animal in the shop of the forest (#83). */
export const SEEDS_PER_ANIMAL = 1;
/** Golden seeds of a season for the painting in progress (#82). */
export const SEEDS_PER_SEASON = 2;
/** Golden seeds of the night for the painting in progress (#85). */
export const SEEDS_PER_NIGHT = 2;
/** Golden seeds of a rare element for the painting in progress: fireflies, rainbow, beavers (#46). */
export const SEEDS_PER_RARE = 2;
/** Golden seeds of the great element of the décor, saved up for: castors, windmill, balloon. */
export const SEEDS_PER_GRAND = 5;
