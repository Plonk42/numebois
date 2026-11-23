import { LEAVES_PER_ELEMENT, SEEDS_PER_ANIMAL, SEEDS_PER_SEASON } from '../core/economy';
import type { AnimalName } from './animal-catalog';
import {
  ANIMAL_OFFERS,
  ELEMENTS_AT_STAGE,
  MAX_ELEMENTS,
  SEASON_STAGES,
  nextSeason,
  type SceneDescription,
} from './description';
import type { Season } from './trees/builder';

/** What the shop of a décor sells (#83): an element to place, an animal, a season. */
export type Article =
  { kind: 'element' } | { kind: 'animal'; animal: AnimalName } | { kind: 'season'; season: Season };

export interface ShopItem {
  article: Article;
  leaves: number;
  seeds: number;
  /** Elements still to place before it comes (an animal waits for its stage); 0 when open. */
  elementsToGo: number;
}

/** A few articles at a time: a short shop, where the child never gets lost. */
export const SHOP_SIZE = 4;

/**
 * The shop at the end of a trail: an element while the painting has free slots, the next
 * season of the year for this painting, then the animals open at this stage (one of each
 * kind), and the next one to come.
 */
export function shopItems(description: SceneDescription): ShopItem[] {
  const items: ShopItem[] = [];
  const placed = description.elements.length;
  if (placed < MAX_ELEMENTS) {
    items.push({
      article: { kind: 'element' },
      leaves: LEAVES_PER_ELEMENT,
      seeds: 0,
      elementsToGo: 0,
    });
  }
  const { seasons } = description;
  if (seasons.length <= SEASON_STAGES.length) {
    let season = nextSeason(seasons[seasons.length - 1]);
    while (seasons.includes(season)) season = nextSeason(season);
    items.push({
      article: { kind: 'season', season },
      leaves: 0,
      seeds: SEEDS_PER_SEASON,
      elementsToGo: Math.max(0, ELEMENTS_AT_STAGE[SEASON_STAGES[seasons.length - 1]] - placed),
    });
  }
  const bought = [...description.animals];
  const left = ANIMAL_OFFERS[description.biome].filter((offer) => {
    const i = bought.indexOf(offer.animal);
    if (i >= 0) bought.splice(i, 1);
    return i < 0;
  });
  const shown = new Set<AnimalName>();
  const open = left.filter((offer) => offer.stage <= description.stage);
  const next = left.find(
    (offer) => offer.stage > description.stage && !open.some((o) => o.animal === offer.animal),
  );
  for (const offer of next ? [...open, next] : open) {
    if (shown.has(offer.animal)) continue;
    shown.add(offer.animal);
    items.push({
      article: { kind: 'animal', animal: offer.animal },
      leaves: 0,
      seeds: SEEDS_PER_ANIMAL,
      elementsToGo: Math.max(0, ELEMENTS_AT_STAGE[offer.stage] - placed),
    });
  }
  return items.slice(0, SHOP_SIZE);
}

/** The reserve pays for it and it is open. */
export function canBuy(item: ShopItem, leaves: number, seeds: number): boolean {
  return item.elementsToGo === 0 && leaves >= item.leaves && seeds >= item.seeds;
}
