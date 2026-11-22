import type { Season } from './trees/builder';

export type Form = 'clearing' | 'hex';
export const FORMS: readonly Form[] = ['clearing', 'hex'];

export type Stage = 0 | 1 | 2 | 3 | 4;
export const STAGES: readonly Stage[] = [0, 1, 2, 3, 4];

/**
 * Everything needed to rebuild a scene identically: the painting is a pure function of
 * this description (and of the growth demo triggered on top of it).
 */
export interface SceneDescription {
  form: Form;
  seed: number;
  stage: Stage;
  season: Season;
}

export const DEFAULT_DESCRIPTION: SceneDescription = {
  form: 'clearing',
  seed: 7,
  stage: 2,
  season: 'summer',
};

const SEASON_NAMES: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function parseDescription(params: URLSearchParams): SceneDescription {
  const form = params.get('form');
  const season = params.get('season');
  const stage = Number(params.get('stage') ?? DEFAULT_DESCRIPTION.stage);
  const seed = Number(params.get('seed') ?? DEFAULT_DESCRIPTION.seed);
  return {
    form: FORMS.includes(form as Form) ? (form as Form) : DEFAULT_DESCRIPTION.form,
    seed: Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : DEFAULT_DESCRIPTION.seed,
    stage: STAGES.includes(stage as Stage) ? (stage as Stage) : DEFAULT_DESCRIPTION.stage,
    season: SEASON_NAMES.includes(season as Season)
      ? (season as Season)
      : DEFAULT_DESCRIPTION.season,
  };
}

export function writeDescription(params: URLSearchParams, description: SceneDescription): void {
  params.set('form', description.form);
  params.set('stage', String(description.stage));
  params.set('season', description.season);
  params.set('seed', String(description.seed));
}
