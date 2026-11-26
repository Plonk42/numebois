import { useLayoutEffect, useRef } from 'preact/hooks';

/** What will grow there: a tree, or a grove of bushes and flowers. */
function KindIcon({ kind }: { kind: 'tree' | 'grove' | null }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'grove' ? (
        <path
          class="crown"
          d="M2.5 19.5a5 5 0 0 1 6-6.2 5.2 5.2 0 0 1 9.3 1.1 3.8 3.8 0 0 1 3.7 5.1z"
        />
      ) : (
        <>
          <rect class="trunk" x="10.5" y="13" width="3" height="9" rx="1" />
          <circle class="crown" cx="12" cy="9" r="7" />
        </>
      )}
    </svg>
  );
}

/** The painting as the choice of a slot sees it. */
export interface SpotsForest {
  slotKind(slot: number): 'tree' | 'grove' | null;
  slotOnScreen(slot: number): { x: number; y: number } | null;
}

interface Props {
  forest: SpotsForest;
  slots: readonly number[];
  onPick(slot: number): void;
}

/** Keeps the spots clear of the reserve, the path and the sound button. */
const TOP = 96;
const EDGE = 48;

/**
 * The free slots offered to the child glow over the forest; one touch places the element.
 * They follow the slow orbit of the camera.
 */
export function Spots({ forest, slots, onPick }: Props) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      slots.forEach((slot, i) => {
        const button = buttons.current[i];
        const at = forest.slotOnScreen(slot);
        if (!button || !at) return;
        // Whole pixels: the slow orbit moves a spot a pixel at a time, not every frame.
        const x = Math.round(Math.min(window.innerWidth - EDGE, Math.max(EDGE, at.x)));
        const y = Math.round(Math.min(window.innerHeight - EDGE, Math.max(TOP, at.y)));
        button.style.transform = `translate(${x}px, ${y}px)`;
      });
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [slots]);
  return (
    <>
      <section id="spots-hint" aria-live="polite">
        <p class="title">Où le faire pousser ?</p>
        <p>Touche une place qui brille.</p>
      </section>
      {slots.map((slot, i) => (
        <button
          key={slot}
          type="button"
          class="spot"
          data-slot={slot}
          aria-label="Planter ici"
          ref={(button) => {
            buttons.current[i] = button;
          }}
          onPointerDown={() => onPick(slot)}
        >
          <KindIcon kind={forest.slotKind(slot)} />
        </button>
      ))}
    </>
  );
}
