import { createOrchard } from '../terrain/orchard';
import type { Biome } from './types';

/**
 * The orchard on its hills (#31): terraced hills rise out of the meadow, strips of tulips,
 * wheat and lavender, rows of fruit trees, a brook falling from terrace to terrace, a windmill
 * on the summit, then the great blossom and the fruits.
 */
export const ORCHARD: Biome = {
  id: 'orchard',
  name: 'Le verger des collines',
  terrain: createOrchard,
  effects: ['ailes du moulin qui tournent', 'grande floraison', 'pétales qui volent'],
  stageNames: [
    'prairie',
    'premiers semis',
    'premiers champs',
    'ruisseau',
    'maisonnette',
    "colline de l'est",
    'grande floraison',
    'champs fleuris',
    'grands champs',
    "colline de l'ouest",
    'fruits',
    'fête des fleurs',
  ],
  // Fields bring the insects early: bees and butterflies from the first strips (2), the brook
  // and its cascades (3), birds of the hedges (4); no woodpecker without a forest.
  life: {
    flowers: [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.85, 0.95, 1, 1, 1.1],
    mushrooms: [0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.8],
    deadwood: [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2],
    butterflies: [0, 0, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1, 1, 1, 1],
    birds: [0, 0, 0, 0, 0.4, 0.6, 0.8, 0.9, 1, 1, 0.8, 0.6],
    sparkle: [0, 0, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 1],
    fallsSound: [0, 0, 0, 0.25, 0.28, 0.3, 0.32, 0.34, 0.36, 0.38, 0.38, 0.36],
    birdsSound: [0, 0, 0.35, 0.4, 0.42, 0.45, 0.4, 0.4, 0.42, 0.36, 0.36, 0.3],
    songs: [0, 0, 1, 1.5, 2, 2.5, 3, 3, 3.5, 3, 2.5, 2],
    meadowSound: [0, 0, 0.25, 0.3, 0.32, 0.36, 0.38, 0.38, 0.36, 0.34, 0.3, 0.26],
    woodpecker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    leavesSound: [0, 0, 0, 0, 0, 0, 0.14, 0.16, 0.18, 0.18, 0.18, 0.15],
  },
  // A softer, blossomy sky.
  light: { horizon: [0xffeaf2, 0.2], hemisphereGround: [0xb8d878, 0.2] },
  vocabulary: {
    gatherers: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'le meunier', to: 'au meunier', pronoun: 'il' },
      { name: 'la fermière', to: 'à la fermière', pronoun: 'elle' },
    ],
    friends: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'l’âne', to: 'à l’âne', pronoun: 'il' },
      { name: 'le cheval', to: 'au cheval', pronoun: 'il' },
      { name: 'la vache', to: 'à la vache', pronoun: 'elle' },
    ],
    items: [
      { one: 'pomme', many: 'pommes' },
      { one: 'poire', many: 'poires' },
      { one: 'cerise', many: 'cerises' },
      { one: 'tulipe', many: 'tulipes' },
      { one: 'noix', many: 'noix' },
    ],
    places: ['sous les pommiers', 'près du moulin', 'dans le verger', 'au bord de l’étang'],
    groups: [
      { group: { one: 'cageot', many: 'cageots' }, item: { one: 'pomme', many: 'pommes' } },
      { group: { one: 'panier', many: 'paniers' }, item: { one: 'cerise', many: 'cerises' } },
      { group: { one: 'caisse', many: 'caisses' }, item: { one: 'poire', many: 'poires' } },
      { group: { one: 'bouquet', many: 'bouquets' }, item: { one: 'tulipe', many: 'tulipes' } },
    ],
  },
};
