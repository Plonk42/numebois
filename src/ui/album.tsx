import type { Skill } from '../core/types';
import { dayLabel } from '../core/day';
import type { AlbumEntry } from '../save/album';
import { BIOMES } from '../scene/biomes';
import { plural } from './reserve';
import { datesLabel } from './finale';

/** The Album's book, under the sound button, once a painting is in it. */
export function AlbumButton({ onOpen }: { onOpen(): void }) {
  return (
    <button id="album-button" type="button" aria-label="Album" onPointerDown={onOpen}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path class="cover" d="M4 7c4-2 8-2 12 1 4-3 8-3 12-1v19c-4-2-8-2-12 1-4-3-8-3-12-1z" />
        <path class="spine" d="M16 8v19" />
        <path
          class="hill"
          d="M7 21l3-4 2 2 2-3v6c-2-1-4-1-7-1zM18 22l3-5 2 3 2-2v4c-2-1-5-1-7 0z"
        />
      </svg>
    </button>
  );
}

interface GridProps {
  entries: readonly AlbumEntry[];
  onVisit(entry: AlbumEntry): void;
  onClose(): void;
}

/** Every painting the child finished, framed, the last one first. */
export function AlbumGrid({ entries, onVisit, onClose }: GridProps) {
  return (
    <section id="album" role="dialog" aria-label="Album">
      <p class="praise">Ton album</p>
      <ul class="pages">
        {entries
          .map((entry, i) => ({ entry, i }))
          .reverse()
          .map(({ entry, i }) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`${BIOMES[entry.description.biome].name}, fini le ${dayLabel(entry.finished)}`}
                onPointerDown={() => onVisit(entry)}
              >
                <img src={entry.picture} alt="" />
                <b>{BIOMES[entry.description.biome].name}</b>
                <span>Fini le {dayLabel(entry.finished)}</span>
              </button>
            </li>
          ))}
      </ul>
      <div class="actions">
        <button type="button" onPointerDown={onClose}>
          Fermer
        </button>
      </div>
    </section>
  );
}

interface PageProps {
  entry: AlbumEntry;
  skills: readonly Skill[];
  onBack(): void;
}

/** A painting of the Album, alive again around a small card: when, and what was learnt. */
export function AlbumPage({ entry, skills, onBack }: PageProps) {
  const names = entry.acquired
    .map((id) => skills.find((skill) => skill.id === id)?.name)
    .filter((name) => name !== undefined);
  const facts = entry.automated.length;
  return (
    <section id="album-page" aria-live="polite">
      <p class="title">{BIOMES[entry.description.biome].name}</p>
      <p class="dates">{datesLabel(entry.started, entry.finished)}</p>
      {names.length > 0 && (
        <>
          <p>Tu as appris :</p>
          <ul class="learnt">
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      )}
      {facts > 0 && <p>Tu connais {plural(facts, 'calcul', 'calculs')} par cœur.</p>}
      <button type="button" onPointerDown={onBack}>
        Retour à l’album
      </button>
    </section>
  );
}
