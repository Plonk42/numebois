import { dayLabel } from '../core/day';
import { named } from '../core/name';
import { BIOMES } from '../scene/biomes';
import type { SceneDescription } from '../scene/description';

/** « Du 23 novembre au 3 décembre », or a single day. */
export function datesLabel(started: number, finished: number): string {
  if (started === finished) return `Le ${dayLabel(finished)}`;
  return `Du ${dayLabel(started)} au ${dayLabel(finished)}`;
}

/** A short line at the bottom during the grand finale, the forest all around it. */
export function FinaleBanner({ framed, name }: { framed: boolean; name: string }) {
  return (
    <section id="finale" class={framed ? 'framed' : ''} aria-live="polite">
      <p class="title">
        {framed ? 'Il rejoint ton album !' : named('Ton tableau est terminé !', name)}
      </p>
    </section>
  );
}

interface FrameProps {
  description: SceneDescription;
  started: number;
  finished: number;
  /** The light comes over the painting: the frame goes with it. */
  away: boolean;
}

/** A wooden frame closes around the whole screen, with its plaque: the painting is done. */
export function Frame({ description, started, finished, away }: FrameProps) {
  return (
    <section id="frame" class={away ? 'away' : ''} aria-label="Tableau encadré">
      <div class="plaque">
        <b>{BIOMES[description.biome].name}</b>
        <span>{datesLabel(started, finished)}</span>
      </div>
    </section>
  );
}

export interface NextChoice {
  description: SceneDescription;
  /** The painting once complete, null while it is drawn. */
  picture: string | null;
}

interface NextProps {
  choices: readonly NextChoice[];
  onPick(description: SceneDescription): void;
}

/** The next painting: the child chooses its décor, each one shown as it will be once complete. */
export function NextPainting({ choices, onPick }: NextProps) {
  const ready = choices.every((choice) => choice.picture);
  return (
    <section id="next-painting" aria-live="polite">
      <p class="praise">Un nouveau tableau !</p>
      {choices.length > 1 && <p class="instruction">Choisis ton décor.</p>}
      <div class="choices" style={{ '--count': choices.length }}>
        {choices.map(({ description, picture }) => (
          <button
            key={description.biome}
            type="button"
            disabled={!ready}
            onPointerDown={() => onPick(description)}
          >
            <span class="picture">{picture && <img src={picture} alt="" />}</span>
            {BIOMES[description.biome].name}
          </button>
        ))}
      </div>
    </section>
  );
}
