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
    place: 'dans la clairière',
    things: ['glands', 'noisettes', 'champignons', 'pommes de pin', 'fleurs', 'cailloux'],
    containers: ['paniers', 'sacs', 'tas'],
    animals: ['biches', 'renards', 'cerfs', 'loups', 'castors', 'oiseaux'],
  },
};
