import { describe, expect, it } from 'vitest';
import { LEAVES_PER_ELEMENT, SEEDS_PER_ANIMAL, SEEDS_PER_SEASON } from '../../src/core/economy';
import {
  ELEMENTS_AT_STAGE,
  MAX_ELEMENTS,
  SEASON_STAGES,
  STAGES,
  demoAnimals,
  newPainting,
  stageFor,
  type SceneDescription,
} from '../../src/scene/description';
import { SHOP_SIZE, canBuy, shopItems, type Article } from '../../src/scene/shop';
import { SEASONS } from '../../src/scene/trees/builder';

/** A painting of the game with this many elements placed and these animals bought. */
function painting(
  placed: number,
  animals: SceneDescription['animals'] = [],
  seasons: SceneDescription['seasons'] = SEASONS,
): SceneDescription {
  return {
    ...newPainting(4, 'summer', 'clearing'),
    stage: stageFor(placed),
    seasons,
    elements: Array.from({ length: placed }, (_, slot) => ({ slot, day: 1 })),
    animals,
  };
}

const nameOf = (article: Article) => {
  if (article.kind === 'element') return 'element';
  return article.kind === 'animal' ? article.animal : article.season;
};
const names = (description: SceneDescription) =>
  shopItems(description).map((item) => nameOf(item.article));

describe('boutique de la forêt', () => {
  it('sells an element in leaves, and shows the first animal to come', () => {
    const [element, deer] = shopItems(painting(0));
    expect(element).toEqual({
      article: { kind: 'element' },
      leaves: LEAVES_PER_ELEMENT,
      seeds: 0,
      elementsToGo: 0,
    });
    // The doe comes at stage 3: what is still to earn, three elements away.
    expect(deer).toEqual({
      article: { kind: 'animal', animal: 'Deer' },
      leaves: 0,
      seeds: SEEDS_PER_ANIMAL,
      elementsToGo: ELEMENTS_AT_STAGE[3],
    });
    expect(canBuy(deer, 99, 99)).toBe(false);
    expect(canBuy(element, LEAVES_PER_ELEMENT, 0)).toBe(true);
    expect(canBuy(element, LEAVES_PER_ELEMENT - 1, 0)).toBe(false);
  });

  it('opens the animals with the stages, one of each kind, and the next one to come', () => {
    const orchard = { ...painting(ELEMENTS_AT_STAGE[5]), biome: 'orchard' as const };
    expect(names(orchard)).toEqual(['element', 'Donkey', 'Alpaca', 'Horse']);
    expect(names(painting(3))).toEqual(['element', 'Deer', 'Fox']);
    expect(names(painting(3, ['Deer']))).toEqual(['element', 'Fox']);
    expect(shopItems(painting(3, ['Deer']))[1].elementsToGo).toBe(ELEMENTS_AT_STAGE[5] - 3);
    // The second doe waits for the first one to be bought.
    expect(names(painting(ELEMENTS_AT_STAGE[8]))).toEqual(['element', 'Deer', 'Fox', 'Stag']);
    expect(names(painting(ELEMENTS_AT_STAGE[8], ['Deer', 'Fox', 'Stag']))).toEqual([
      'element',
      'Deer',
      'Wolf',
    ]);
    // Everything bought, the painting complete: nothing left to sell.
    expect(names(painting(MAX_ELEMENTS, demoAnimals('clearing', 11)))).toEqual([]);
  });

  it('stays short, and never offers more animals than the meadow takes', () => {
    for (const stage of STAGES) {
      const placed = ELEMENTS_AT_STAGE[stage];
      let animals: SceneDescription['animals'] = [];
      // Buys every animal it can, as soon as it can.
      for (;;) {
        const items = shopItems(painting(placed, animals));
        expect(items.length).toBeLessThanOrEqual(SHOP_SIZE);
        const item = items.find((i) => i.article.kind === 'animal' && canBuy(i, 0, 99));
        if (!item || item.article.kind !== 'animal') break;
        animals = [...animals, item.article.animal];
      }
      expect([...animals].sort(), `stage ${stage}`).toEqual(demoAnimals('clearing', stage).sort());
    }
  });

  it('sells the next season of the year, one at a time, as the painting grows (#82)', () => {
    const fresh = (placed: number, seasons: SceneDescription['seasons']) =>
      painting(placed, [], seasons);
    // A new painting of summer: autumn comes at stage 3, in golden seeds.
    const [, autumn] = shopItems(fresh(0, ['summer']));
    expect(autumn).toEqual({
      article: { kind: 'season', season: 'autumn' },
      leaves: 0,
      seeds: SEEDS_PER_SEASON,
      elementsToGo: ELEMENTS_AT_STAGE[SEASON_STAGES[0]],
    });
    expect(names(fresh(ELEMENTS_AT_STAGE[3], ['summer']))).toEqual([
      'element',
      'autumn',
      'Deer',
      'Fox',
    ]);
    expect(canBuy(shopItems(fresh(ELEMENTS_AT_STAGE[3], ['summer']))[1], 0, 3)).toBe(true);
    // Then winter at stage 7, and spring at stage 10; the year goes round from any start.
    const winter = shopItems(fresh(ELEMENTS_AT_STAGE[3], ['summer', 'autumn']))[1];
    expect(nameOf(winter.article)).toBe('winter');
    expect(winter.elementsToGo).toBe(ELEMENTS_AT_STAGE[7] - ELEMENTS_AT_STAGE[3]);
    const spring = shopItems(fresh(ELEMENTS_AT_STAGE[10], ['summer', 'autumn', 'winter']))[1];
    expect(nameOf(spring.article)).toBe('spring');
    expect(spring.elementsToGo).toBe(0);
    expect(nameOf(shopItems(fresh(0, ['winter']))[1].article)).toBe('spring');
    // Four seasons: none left to sell.
    expect(
      shopItems(fresh(ELEMENTS_AT_STAGE[11], SEASONS)).every((i) => i.article.kind !== 'season'),
    ).toBe(true);
  });
});
