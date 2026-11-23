import type { Season } from './trees/builder';

export const STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Stage = (typeof STAGES)[number];
export const LAST_STAGE: Stage = 11;
/** One value per stage. */
export type PerStage<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T];

/**
 * The three grand moments of a painting, announced from the start and revealed during play:
 * a lake fills its dry hollow, a great mountain comes out of the haze, the next season comes.
 */
export const LANDMARKS = ['lake', 'mountain', 'season'] as const;
export type Landmark = (typeof LANDMARKS)[number];

/**
 * Everything needed to rebuild a scene identically: the painting is a pure function of
 * this description (and of the growth demo triggered on top of it).
 */
export interface SceneDescription {
  seed: number;
  stage: Stage;
  /** Season the painting started in; the season moment brings the next one. */
  season: Season;
  /** Share of the slots filled (0 to 1), until the elements are really placed (#25). */
  fill: number;
  /** Grand moments already revealed. */
  landmarks: readonly Landmark[];
}

/** Share of the slots filled by default at each stage, as if the child had played. */
export const DEMO_FILL: PerStage<number> = [
  0.2, 0.3, 0.33, 0.36, 0.4, 0.45, 0.55, 0.6, 0.7, 0.75, 0.9, 1,
];

export const DEFAULT_DESCRIPTION: SceneDescription = {
  seed: 7,
  stage: 6,
  season: 'summer',
  fill: DEMO_FILL[6],
  landmarks: [],
};

const SEASON_NAMES: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Season shown by the painting: the next one once the season moment is revealed. */
export function shownSeason(description: SceneDescription): Season {
  const { season, landmarks } = description;
  return landmarks.includes('season') ? nextSeason(season) : season;
}

export function nextSeason(season: Season): Season {
  return SEASON_NAMES[(SEASON_NAMES.indexOf(season) + 1) % SEASON_NAMES.length];
}

export function parseDescription(params: URLSearchParams): SceneDescription {
  const season = params.get('season');
  const stage = Number(params.get('stage') ?? DEFAULT_DESCRIPTION.stage);
  const seed = Number(params.get('seed') ?? DEFAULT_DESCRIPTION.seed);
  const knownStage = STAGES.includes(stage as Stage) ? (stage as Stage) : DEFAULT_DESCRIPTION.stage;
  const fill = Number(params.get('fill') ?? Number.NaN);
  const landmarks = new Set((params.get('landmarks') ?? '').split(','));
  return {
    seed: Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : DEFAULT_DESCRIPTION.seed,
    stage: knownStage,
    season: SEASON_NAMES.includes(season as Season)
      ? (season as Season)
      : DEFAULT_DESCRIPTION.season,
    fill: Number.isFinite(fill) ? Math.min(1, Math.max(0, fill / 100)) : DEMO_FILL[knownStage],
    landmarks: LANDMARKS.filter((landmark) => landmarks.has(landmark)),
  };
}

export function writeDescription(params: URLSearchParams, description: SceneDescription): void {
  params.set('stage', String(description.stage));
  params.set('season', description.season);
  params.set('seed', String(description.seed));
  params.set('fill', String(Math.round(description.fill * 100)));
  if (description.landmarks.length > 0) params.set('landmarks', description.landmarks.join(','));
  else params.delete('landmarks');
}
