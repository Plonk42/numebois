import { createSkyIslands } from '../terrain/sky';
import type { Biome } from './types';

/**
 * The sky islands (#32): an archipelago over a sea of clouds that rises stage after stage,
 * islands joined by rope bridges, then the great suspension bridge; the high island's cascade
 * falls over three tiers into the clouds, and a balloon drifts between the islands at the end.
 */
export const SKY: Biome = {
  id: 'sky',
  name: 'Les îles du ciel',
  terrain: createSkyIslands,
  effects: [
    'mer de nuages',
    'chutes dans la brume',
    'ponts de cordes',
    'pont suspendu',
    'montgolfière',
  ],
  stageNames: [
    'île flottante',
    'petite île',
    'source',
    'île voisine',
    'pont de cordes',
    'île haute',
    'pont suspendu',
    'îlot suspendu',
    'grande cascade',
    'chapelet d’îles',
    'île perchée',
    'grand archipel',
  ],
  // Wind and birds of the heights from the start, the falls from the spring (2); fewer insects
  // and no woodpecker so high up.
  life: {
    flowers: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1],
    mushrooms: [0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7],
    deadwood: [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2],
    lilies: [0, 0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.87, 0.94, 1, 1, 1],
    butterflies: [0, 0, 0, 0, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.8, 0.7],
    birds: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1, 1, 1, 0.9, 0.8],
    sunRays: [0, 0, 0, 0, 0, 0, 0, 0.6, 0.7, 0.8, 0.9, 1],
    sparkle: [0, 0, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.35, 0.45, 0.6, 1],
    windSound: [0.8, 0.8, 0.75, 0.72, 0.7, 0.68, 0.64, 0.6, 0.56, 0.52, 0.5, 0.48],
    pondSound: [0, 0, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.18, 0.18, 0.16, 0.15],
    fallsSound: [0, 0, 0.3, 0.32, 0.33, 0.34, 0.35, 0.36, 0.44, 0.44, 0.44, 0.42],
    brookSound: [0, 0, 0.25, 0.26, 0.27, 0.28, 0.28, 0.28, 0.3, 0.3, 0.3, 0.28],
    birdsSound: [0.25, 0.3, 0.32, 0.36, 0.4, 0.42, 0.4, 0.4, 0.4, 0.36, 0.34, 0.3],
    songs: [0.5, 1, 1.2, 1.5, 2, 2.5, 3, 3, 3, 3, 2.5, 2],
    chorusSound: [0, 0, 0, 0, 0, 0, 0.15, 0.18, 0.2, 0.2, 0.18, 0.15],
    meadowSound: [0, 0, 0, 0, 0.2, 0.22, 0.24, 0.24, 0.24, 0.22, 0.2, 0.18],
    woodpecker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cuckoo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    leavesSound: [0, 0, 0, 0, 0, 0, 0.12, 0.14, 0.16, 0.18, 0.18, 0.15],
    magic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.6],
  },
  // A higher, clearer sky, its haze tinted lilac by the clouds below.
  light: { zenith: [0x4f9ff2, 0.2], nadir: [0xe8e4fa, 0.35], fog: [0xe6e8fa, 0.25] },
  vocabulary: {
    gatherers: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'la pilote', to: 'à la pilote', pronoun: 'elle' },
      { name: 'le berger', to: 'au berger', pronoun: 'il' },
    ],
    friends: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'l’aigle', to: 'à l’aigle', pronoun: 'il' },
      { name: 'le cerf', to: 'au cerf', pronoun: 'il' },
      { name: 'l’alpaga', to: 'à l’alpaga', pronoun: 'il' },
    ],
    items: [
      { one: 'planche', many: 'planches' },
      { one: 'corde', many: 'cordes' },
      { one: 'plume', many: 'plumes' },
      { one: 'cristal', many: 'cristaux' },
      { one: 'nuage', many: 'nuages' },
    ],
    places: ['sur l’île haute', 'près du pont', 'sous la cascade', 'sur la petite île'],
    groups: [
      { group: { one: 'pile', many: 'piles' }, item: { one: 'planche', many: 'planches' } },
      { group: { one: 'rouleau', many: 'rouleaux' }, item: { one: 'corde', many: 'cordes' } },
      { group: { one: 'sac', many: 'sacs' }, item: { one: 'plume', many: 'plumes' } },
      { group: { one: 'coffre', many: 'coffres' }, item: { one: 'cristal', many: 'cristaux' } },
    ],
  },
};
