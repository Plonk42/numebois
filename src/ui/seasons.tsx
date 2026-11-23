import type { JSX } from 'preact';
import { SEASONS, type Season } from '../scene/trees/builder';

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Le printemps',
  summer: 'L’été',
  autumn: 'L’automne',
  winter: 'L’hiver',
};

const turns = (count: number) => Array.from({ length: count }, (_, i) => (i * 360) / count);

const SHAPES: Record<Season, JSX.Element> = {
  spring: (
    <>
      {turns(5).map((a) => (
        <circle key={a} class="petal" cx="32" cy="18" r="11" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle class="heart" cx="32" cy="32" r="7" />
    </>
  ),
  summer: (
    <>
      {turns(8).map((a) => (
        <path key={a} class="ray" d="M32 5v9" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle class="disc" cx="32" cy="32" r="14" />
    </>
  ),
  autumn: (
    <>
      <path class="leaf" d="M12 52C9 31 25 12 54 10c1 28-15 44-42 42z" />
      <path class="vein" d="M12 52L42 22" />
    </>
  ),
  winter: (
    <>
      {turns(6).map((a) => (
        <path key={a} class="branch" d="M32 32V8M24 14l8 7 8-7" transform={`rotate(${a} 32 32)`} />
      ))}
    </>
  ),
};

/** A season in one picture: blossom, sun, red leaf, snowflake. */
export function SeasonIcon({ season }: { season: Season }) {
  return (
    <svg class={`season-icon ${season}`} viewBox="0 0 64 64" aria-hidden="true">
      {SHAPES[season]}
    </svg>
  );
}

interface Props {
  /** Seasons of the painting. */
  seasons: readonly Season[];
  season: Season;
  /** Off while the season changes under the light. */
  active: boolean;
  onPick(season: Season): void;
}

/** The seasons of the painting, next to the sound button: one touch shows another. */
export function SeasonPicker({ seasons, season, active, onPick }: Props) {
  return (
    <div id="seasons" role="group" aria-label="Saison du tableau" class={active ? '' : 'resting'}>
      {SEASONS.filter((s) => seasons.includes(s)).map((s) => (
        <button
          key={s}
          type="button"
          aria-label={SEASON_LABELS[s]}
          aria-pressed={s === season}
          disabled={!active}
          onPointerDown={() => {
            if (s !== season) onPick(s);
          }}
        >
          <SeasonIcon season={s} />
        </button>
      ))}
    </div>
  );
}
