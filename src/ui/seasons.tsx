import type { JSX } from 'preact';
import type { SeasonChoice } from '../scene/description';

export const SEASON_LABELS: Record<SeasonChoice, string> = {
  spring: 'Le printemps',
  summer: 'L’été',
  autumn: 'L’automne',
  winter: 'L’hiver',
  night: 'La nuit',
};

const turns = (count: number) => Array.from({ length: count }, (_, i) => (i * 360) / count);

const SHAPES: Record<SeasonChoice, JSX.Element> = {
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
  night: (
    <>
      <path class="moon" d="M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8z" />
      <path class="star" d="M47 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </>
  ),
};

/** A season in one picture: blossom, sun, red leaf, snowflake; the night: a moon and a star. */
export function SeasonIcon({ season }: { season: SeasonChoice }) {
  return (
    <svg class={`season-icon ${season}`} viewBox="0 0 64 64" aria-hidden="true">
      {SHAPES[season]}
    </svg>
  );
}

interface Props {
  /** Seasons of the painting, then its night. */
  choices: readonly SeasonChoice[];
  shown: SeasonChoice;
  /** Off while the season changes under the light. */
  active: boolean;
  onPick(choice: SeasonChoice): void;
}

/** The seasons of the painting and its night, next to the sound button: one touch shows another. */
export function SeasonPicker({ choices, shown, active, onPick }: Props) {
  return (
    <div id="seasons" role="group" aria-label="Saison du tableau" class={active ? '' : 'resting'}>
      {choices.map((s) => (
        <button
          key={s}
          type="button"
          aria-label={SEASON_LABELS[s]}
          aria-pressed={s === shown}
          disabled={!active}
          onPointerDown={() => {
            if (s !== shown) onPick(s);
          }}
        >
          <SeasonIcon season={s} />
        </button>
      ))}
    </div>
  );
}
