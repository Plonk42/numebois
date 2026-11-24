import { STAGE_NAMES } from '../render/richness';
import { createClearing } from '../terrain/clearing';
import type { Biome } from './types';

/** The clearing at the foot of its mountains: the first décor (phase R). */
export const CLEARING: Biome = {
  id: 'clearing',
  name: 'La clairière',
  terrain: createClearing,
  effects: ['cascades', 'ruisseaux', 'lac des castors', 'chaîne lointaine', 'arc-en-ciel'],
  stageNames: STAGE_NAMES,
  vocabulary: {
    gatherers: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'l’écureuil', to: 'à l’écureuil', pronoun: 'il' },
      { name: 'le renard', to: 'au renard', pronoun: 'il' },
    ],
    friends: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'la biche', to: 'à la biche', pronoun: 'elle' },
      { name: 'le cerf', to: 'au cerf', pronoun: 'il' },
      { name: 'le castor', to: 'au castor', pronoun: 'il' },
    ],
    items: [
      { one: 'gland', many: 'glands' },
      { one: 'noisette', many: 'noisettes' },
      { one: 'champignon', many: 'champignons' },
      { one: 'fleur', many: 'fleurs' },
      { one: 'caillou', many: 'cailloux' },
    ],
    places: ['près du ruisseau', 'sous les chênes', 'au bord du lac', 'dans la clairière'],
    groups: [
      {
        group: { one: 'panier', many: 'paniers' },
        item: { one: 'champignon', many: 'champignons' },
      },
      { group: { one: 'tas', many: 'tas' }, item: { one: 'noisette', many: 'noisettes' } },
      { group: { one: 'sac', many: 'sacs' }, item: { one: 'gland', many: 'glands' } },
      { group: { one: 'bouquet', many: 'bouquets' }, item: { one: 'fleur', many: 'fleurs' } },
    ],
  },
};
