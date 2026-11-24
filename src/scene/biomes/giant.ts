import { createGiantTree } from '../terrain/giant';
import type { Biome } from './types';

/**
 * The great tree of Plume (#92): a giant tree in the middle of a forest meadow grows from a
 * sprout to a colossus whose crown frames the top of the picture; decks, ladders and a stair
 * climb its trunk, then Plume's cabin, a swing and nesting boxes; lanterns light up at dusk.
 */
export const GIANT: Biome = {
  id: 'giant',
  name: 'Le grand arbre de Plume',
  terrain: createGiantTree,
  effects: ['rayons sous la couronne', 'feuilles en spirale', 'cabane de Plume', 'lanternes'],
  stageNames: [
    'pousse',
    'jeune arbre',
    'source',
    'grandes branches',
    'échelle',
    'escalier',
    'cabane de Plume',
    'balançoire',
    'nichoirs',
    'belvédère',
    'colosse',
    'lanternes',
  ],
  // A forest meadow: songbirds and the woodpecker early, leaves in the wind as the crown
  // spreads, the tawny owl and the crickets at dusk.
  life: {
    flowers: [0, 0.1, 0.18, 0.25, 0.4, 0.55, 0.7, 0.8, 0.9, 1, 1, 1.1],
    mushrooms: [0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.55, 0.7, 0.85, 1, 1.2],
    deadwood: [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4],
    edgeTrees: [0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.75, 0.8, 0.86, 0.92, 0.97, 1],
    butterflies: [0, 0, 0, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.8, 0.7, 0.5],
    fallingLeaves: [0.05, 0.1, 0.15, 0.2, 0.26, 0.32, 0.38, 0.44, 0.5, 0.56, 0.62, 0.66],
    birds: [0, 0, 0, 0, 0.3, 0.5, 0.7, 0.8, 1, 1, 0.9, 0.6],
    sunRays: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    canopyRays: [0, 0, 0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 0.4],
    fireflies: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1],
    dusk: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    sparkle: [0, 0, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 1],
    pondSound: [0, 0, 0.4, 0.36, 0.32, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.18],
    fallsSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    brookSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    birdsSound: [0, 0.3, 0.35, 0.4, 0.45, 0.48, 0.45, 0.45, 0.48, 0.42, 0.38, 0.25],
    songs: [0, 1, 1.5, 2, 2.5, 3, 3, 3.5, 4, 3.5, 3, 1.5],
    woodpecker: [0, 0, 0, 0.4, 0.5, 0.6, 0.6, 0.6, 0.6, 0.5, 0.5, 0.2],
    leavesSound: [0, 0, 0, 0.15, 0.2, 0.24, 0.26, 0.28, 0.3, 0.3, 0.3, 0.25],
    cricketsSound: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4],
    owl: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8],
  },
  // A green shade under the leaves.
  light: { hemisphereGround: [0x7fae5a, 0.25], fog: [0xe2efd6, 0.2] },
  vocabulary: {
    gatherers: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'l’écureuil', to: 'à l’écureuil', pronoun: 'il' },
      { name: 'la chouette', to: 'à la chouette', pronoun: 'elle' },
    ],
    friends: [
      { name: 'Plume', to: 'à Plume', pronoun: 'elle' },
      { name: 'le pic', to: 'au pic', pronoun: 'il' },
      { name: 'la biche', to: 'à la biche', pronoun: 'elle' },
      { name: 'le renard', to: 'au renard', pronoun: 'il' },
    ],
    items: [
      { one: 'gland', many: 'glands' },
      { one: 'noisette', many: 'noisettes' },
      { one: 'baie', many: 'baies' },
      { one: 'feuille', many: 'feuilles' },
      { one: 'plume', many: 'plumes' },
    ],
    places: ['dans la cabane', 'au premier étage', 'au deuxième étage', 'sous le grand arbre'],
    groups: [
      { group: { one: 'sac', many: 'sacs' }, item: { one: 'gland', many: 'glands' } },
      { group: { one: 'panier', many: 'paniers' }, item: { one: 'noisette', many: 'noisettes' } },
      { group: { one: 'échelle', many: 'échelles' }, item: { one: 'échelon', many: 'échelons' } },
      {
        group: { one: 'guirlande', many: 'guirlandes' },
        item: { one: 'lanterne', many: 'lanternes' },
      },
    ],
  },
};
