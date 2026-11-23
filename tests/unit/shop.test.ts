import { describe, expect, it } from 'vitest';
import { LEAVES_PER_ELEMENT, SEEDS_PER_ANIMAL } from '../../src/core/economy';
import {
  ELEMENTS_AT_STAGE,
  MAX_ELEMENTS,
  STAGES,
  demoAnimals,
  newPainting,
  stageFor,
  type SceneDescription,
} from '../../src/scene/description';
import { SHOP_SIZE, canBuy, shopItems } from '../../src/scene/shop';

/** A painting of the game with this many elements placed and these animals bought. */
function painting(placed: number, animals: SceneDescription['animals'] = []): SceneDescription {
  return {
    ...newPainting(4, 'summer'),
    stage: stageFor(placed),
    elements: Array.from({ length: placed }, (_, slot) => ({ slot, day: 1 })),
    animals,
  };
}

const names = (description: SceneDescription) =>
  shopItems(description).map((item) =>
    item.article.kind === 'element' ? 'element' : item.article.animal,
  );

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
    expect(names(painting(MAX_ELEMENTS, demoAnimals(11)))).toEqual([]);
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
      expect([...animals].sort(), `stage ${stage}`).toEqual(demoAnimals(stage).sort());
    }
  });
});
