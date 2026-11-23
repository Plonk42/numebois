import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Basket } from './basket';
import { Plume, type PlumeMood } from './plume';
import './slate.css';

export interface SlateHint {
  title: string;
  text: string;
  /** After the answer is shown: the button that goes on (also the Enter key). */
  onNext?: () => void;
}

interface SlateProps {
  /** The instruction, or the praise after a right answer. */
  heading: ComponentChildren;
  plume: PlumeMood;
  /** Plume's bubble, at the bottom of the work area: never under the finger. */
  hint: SlateHint | null;
  /** Steps aside while the forest grows. */
  away: boolean;
  /** Leaves of the trail in Plume's basket. */
  basket: number;
  /** The widget: its `Work` and `AnswerZone`. */
  children: ComponentChildren;
}

/**
 * The slate: one exercise at a time, in the middle of the screen over the dimmed forest.
 * The heading on top, the work area on the left with Plume's hints under it, the answer
 * zone at the bottom right, always in the same place.
 */
export function Slate({ heading, plume, hint, away, basket, children }: SlateProps) {
  const next = useRef(hint?.onNext);
  next.current = hint?.onNext;
  const hasNext = next.current !== undefined;
  // Subscribed after the render: the Enter of the last answer does not also go on.
  useEffect(() => {
    if (!hasNext) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      next.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext]);

  return (
    <section id="question" class={away ? 'away' : ''} aria-live="polite">
      <Plume mood={plume} />
      <Basket leaves={basket} pouring={false} />
      <header>{heading}</header>
      <div class="bench">
        {children}
        {hint && (
          <div class="hint">
            <strong>{hint.title}</strong>
            <span>{hint.text}</span>
            {hint.onNext && (
              <button type="button" class="next" onPointerDown={hint.onNext}>
                Suivant
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * What the child works on, left of the answer zone (about 430 × 450 px). `wide` takes the
 * whole width of the slate (ruler, number line), the answer zone then goes under it.
 */
export function Work({ wide = false, children }: { wide?: boolean; children: ComponentChildren }) {
  return <div class={wide ? 'work wide' : 'work'}>{children}</div>;
}

/** Bottom right of the slate, 300 px wide: the keys or the choices, under the finger. */
export function AnswerZone({ children }: { children: ComponentChildren }) {
  return <div class="answer-zone">{children}</div>;
}

/** Shorter statements are written larger. */
function statementSize(text: string): string {
  if (text.length <= 14) return 'large';
  if (text.length <= 24) return 'medium';
  if (text.length <= 48) return 'small';
  return 'text';
}

/** The statement, large, in the work area. */
export function Statement({ text }: { text: string }) {
  return <p class={`statement ${statementSize(text)}`}>{text}</p>;
}
