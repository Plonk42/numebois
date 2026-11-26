import type { Lesson } from '../core/types';

/** The Carnet de la forêt, under the sound button (or the Album's book): the astuces seen. */
export function NotebookButton({ low, onOpen }: { low: boolean; onOpen(): void }) {
  return (
    <button
      id="notebook-button"
      type="button"
      class={low ? 'low' : ''}
      aria-label="Carnet"
      onPointerDown={onOpen}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect class="cover" x="7" y="4" width="19" height="24" rx="3" />
        <path class="rings" d="M7 9h-2M7 16h-2M7 23h-2" />
        <path class="leaf" d="M12 20c0-6 4-9 10-10-1 6-4 10-10 10zM12 20l5-5" />
      </svg>
    </button>
  );
}

interface NotebookProps {
  /** The astuces seen, in the order they came. */
  pages: readonly Lesson[];
  /** The page just added, marked. */
  fresh: string | null;
  onOpen(lesson: Lesson): void;
  onClose(): void;
}

/** One page per astuce seen, the last one first; a touch plays it again. */
export function Notebook({ pages, fresh, onOpen, onClose }: NotebookProps) {
  return (
    <section id="notebook" class="card" role="dialog" aria-label="Carnet">
      <p class="praise">Ton carnet</p>
      <ul class="pages">
        {[...pages].reverse().map((lesson) => (
          <li key={lesson.id}>
            <button
              type="button"
              class={lesson.id === fresh ? 'fresh' : ''}
              onPointerDown={() => onOpen(lesson)}
            >
              <b>{lesson.title}</b>
              {lesson.id === fresh && <span>Nouvelle page</span>}
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
