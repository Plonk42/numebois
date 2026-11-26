import { createMountain } from '../terrain/mountain';
import type { Biome } from './types';

/**
 * The mountain of the torrents (#136): a high-mountain gorge. Rock ledges rise around a pool,
 * steep snowy peaks and needles behind and beside them; three torrents fall from ledge to
 * ledge, meet and fall together into the pool, the great cascade in its spray, the eagles.
 */
export const MOUNTAIN: Biome = {
  id: 'mountain',
  name: 'La montagne des torrents',
  terrain: createMountain,
  effects: ['pics enneigés', 'torrents qui se rejoignent', 'embruns', 'aigles qui planent'],
  stageNames: [
    'premier torrent',
    'replat suspendu',
    'aiguille de l’ouest',
    'grand pic',
    'deuxième torrent',
    'aiguille de l’est',
    'grande cascade',
    'troisième torrent',
    'pic de l’ouest',
    'cascades de l’est',
    'pic de l’est',
    'sommet',
  ],
  // The torrent from the first stage, louder as it swells; birds of the heights, few insects,
  // no woodpecker above the forest.
  life: {
    flowers: [0, 0.08, 0.15, 0.22, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9],
    mushrooms: [0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    deadwood: [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3],
    butterflies: [0, 0, 0, 0, 0, 0.2, 0.35, 0.5, 0.6, 0.6, 0.55, 0.5],
    birds: [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1, 1],
    sparkle: [0, 0, 0.05, 0.08, 0.1, 0.15, 0.3, 0.35, 0.4, 0.45, 0.6, 1],
    windSound: [0.6, 0.6, 0.58, 0.56, 0.54, 0.52, 0.5, 0.48, 0.46, 0.44, 0.44, 0.44],
    pondSound: [0.2, 0.2, 0.3, 0.28, 0.26, 0.24, 0.2, 0.18, 0.16, 0.15, 0.14, 0.14],
    fallsSound: [0.2, 0.24, 0.27, 0.3, 0.33, 0.36, 0.46, 0.48, 0.5, 0.5, 0.5, 0.5],
    brookSound: [0.2, 0.22, 0.24, 0.26, 0.28, 0.3, 0.32, 0.32, 0.32, 0.32, 0.32, 0.3],
    birdsSound: [0, 0.2, 0.25, 0.3, 0.32, 0.35, 0.35, 0.36, 0.36, 0.34, 0.32, 0.3],
    songs: [0, 0.5, 1, 1.2, 1.5, 2, 2, 2.5, 2.5, 2.5, 2, 2],
    meadowSound: [0, 0, 0, 0, 0, 0, 0, 0.3, 0.32, 0.32, 0.3, 0.28],
    woodpecker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cuckoo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // Needles rustle less than leaves.
    leavesSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.18, 0.18, 0.15],
  },
  // A crisp, deep blue mountain sky.
  light: { zenith: [0x3f8ee8, 0.25], horizon: [0xe4f0fb, 0.2], fog: [0xdfe9f4, 0.2] },
  vocabulary: {
    gatherers: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'la bergère', to: 'à la bergère', pronoun: 'elle' },
      { name: 'le guide', to: 'au guide', pronoun: 'il' },
    ],
    friends: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'l’aigle', to: 'à l’aigle', pronoun: 'il' },
      { name: 'la marmotte', to: 'à la marmotte', pronoun: 'elle' },
      { name: 'le cerf', to: 'au cerf', pronoun: 'il' },
    ],
    items: [
      { one: 'caillou', many: 'cailloux' },
      { one: 'myrtille', many: 'myrtilles' },
      { one: 'edelweiss', many: 'edelweiss' },
      { one: 'fraise', many: 'fraises' },
      { one: 'cristal', many: 'cristaux' },
    ],
    places: ['près du torrent', 'sur le gradin', 'au bord du bassin', 'sous les sapins'],
    groups: [
      { group: { one: 'sac', many: 'sacs' }, item: { one: 'caillou', many: 'cailloux' } },
      { group: { one: 'panier', many: 'paniers' }, item: { one: 'myrtille', many: 'myrtilles' } },
      {
        group: { one: 'bouquet', many: 'bouquets' },
        item: { one: 'edelweiss', many: 'edelweiss' },
      },
      { group: { one: 'boîte', many: 'boîtes' }, item: { one: 'cristal', many: 'cristaux' } },
    ],
  },
};
