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
    'terrasses',
    "colline de l'est",
    'moulin',
    'champs fleuris',
    'grande floraison',
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
    leavesSound: [0, 0, 0, 0, 0, 0, 0, 0, 0.14, 0.18, 0.18, 0.15],
  },
  // A softer, blossomy sky.
  light: { horizon: [0xffeaf2, 0.2], hemisphereGround: [0xb8d878, 0.2] },
  vocabulary: {
    place: 'dans le verger',
    things: ['pommes', 'poires', 'cerises', 'tulipes', 'brins de lavande', 'épis de blé'],
    containers: ['paniers', 'caisses', 'sacs de farine', 'rangées', 'ruches'],
    animals: ['ânes', 'alpagas', 'chevaux', 'vaches', 'abeilles', 'papillons'],
  },
};
