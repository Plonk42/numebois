/**
 * Recorded sounds of the soundscape: CC0 recordings from Freesound (see LICENSES.md), cut,
 * looped and encoded by `npm run sounds` into `public/assets/sounds/`. The wind stays
 * synthesised by the code.
 */

export interface SoundSource {
  /** Freesound sound id and author; the preview key is `<id>_<user id>`. */
  freesound: number;
  user: number;
  author: string;
  title: string;
}

/** A seamless loop: a window of the recording, its end cross-faded into its start. */
export interface LoopSound extends SoundSource {
  kind: 'loop';
  from: number;
  seconds: number;
}

/** Short calls played now and then: cuts of the recording, kept in one file. */
export interface CallSound extends SoundSource {
  kind: 'calls';
  /** Start and end of each cut, in seconds. */
  cuts: readonly (readonly [number, number])[];
}

const source = (freesound: number, user: number, author: string, title: string) => ({
  freesound,
  user,
  author,
  title,
});

export const SOUND_CATALOG = {
  // Water: the spring's pond, the stream, the falls (chosen by ear by the owner).
  pond: {
    kind: 'loop',
    ...source(528067, 3713344, 'laughatlantic', 'Water lapping on lake Pukaki'),
    from: 0,
    seconds: 20,
  },
  brook: {
    kind: 'loop',
    ...source(678268, 14784311, 'msx2plus', 'seamless stereo creek loop 02'),
    from: 0,
    seconds: 17,
  },
  falls: {
    kind: 'loop',
    ...source(231536, 4034520, 'VKProduktion', 'Creek 06 (loop)'),
    from: 2,
    seconds: 22,
  },
  // Birds: a distant chorus, then a livelier one; songs and calls on top.
  birds: {
    kind: 'loop',
    ...source(231537, 4034520, 'VKProduktion', 'Forest_Birds (loop) 02'),
    from: 0,
    seconds: 27,
  },
  chorus: {
    kind: 'loop',
    ...source(723913, 2008500, 'Magnesus', 'Forest birds - ambient seamless loop'),
    from: 0,
    seconds: 24,
  },
  meadow: {
    kind: 'loop',
    ...source(409143, 85211, 'baryy', 'Summer Meadow'),
    from: 62,
    seconds: 24,
  },
  leaves: {
    kind: 'loop',
    ...source(403051, 338690, 'teadrinker', 'wind_forest_08_strong_l_01'),
    from: 2,
    seconds: 26,
  },
  crickets: {
    kind: 'loop',
    ...source(210540, 985466, 'Sclolex', 'crickets'),
    from: 0,
    seconds: 24,
  },
  chaffinch: {
    kind: 'calls',
    ...source(186024, 1038806, 'unfa', 'Birdsong Singleshot Denoised Wakeup Alarm'),
    cuts: [[0.1, 2.7]],
  },
  blackbird: {
    kind: 'calls',
    ...source(195909, 134545, 'tinga', 'Common Blackbird 13_seq'),
    cuts: [
      [6.3, 7.6],
      [11.75, 13.3],
      [16.95, 19.0],
      [23.0, 24.7],
      [47.0, 48.9],
    ],
  },
  woodpecker: {
    kind: 'calls',
    ...source(428146, 7455632, 'naturenotesuk', 'Great Spotted Woodpecker'),
    cuts: [
      [2.4, 3.5],
      [7.15, 8.6],
      [30.6, 31.7],
    ],
  },
  cuckoo: {
    kind: 'calls',
    ...source(475049, 10112392, 'SiliconeSound', 'Cuckoo'),
    cuts: [
      [0.5, 4.1],
      [39.1, 42.0],
      [53.1, 56.4],
    ],
  },
  owl: { kind: 'calls', ...source(465697, 9159316, 'Breviceps', 'Owl Hoot'), cuts: [[0.1, 4.3]] },
  chime: {
    kind: 'calls',
    ...source(351408, 4067257, 'newagesoup', 'GLEAM-GLOW-SFX-CHIME'),
    cuts: [[1.3, 5.3]],
  },
  chimes: { kind: 'calls', ...source(389789, 6152820, 'fmceretta', 'Chimes'), cuts: [[0.5, 6.1]] },
  // Rewards of the trail (#36), from one synthesised pack so they sound alike.
  right: {
    kind: 'calls',
    ...source(878606, 19512113, 'Qvantor', 'Task Complete Pop'),
    cuts: [[0, 0.7]],
  },
  seed: { kind: 'calls', ...source(878614, 19512113, 'Qvantor', 'Gem Sparkle'), cuts: [[0, 2.3]] },
  stage: {
    kind: 'calls',
    ...source(878598, 19512113, 'Qvantor', 'Level Up Magic Harp'),
    cuts: [[0, 3.45]],
  },
  finale: {
    kind: 'calls',
    ...source(878605, 19512113, 'Qvantor', 'Quest Complete'),
    cuts: [[0, 4]],
  },
} as const satisfies Record<string, LoopSound | CallSound>;

export type SoundName = keyof typeof SOUND_CATALOG;
export type LoopName = {
  [K in SoundName]: (typeof SOUND_CATALOG)[K]['kind'] extends 'loop' ? K : never;
}[SoundName];
export type CallName = Exclude<SoundName, LoopName>;
