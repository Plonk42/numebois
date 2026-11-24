import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExerciseInput } from '../../core/types';
import { AnswerZone, Work } from '../slate';
import type { WidgetProps } from './index';

const SIGNS = ['<', '=', '>'] as const;

/**
 * Two numbers apart with an empty place between them: a touch on a sign sets it there, the
 * child may change it, then confirms. A sign already tried stays dimmed, never red. Keyboard:
 * the sign itself or 1 to 3, Backspace, Enter.
 */
export function CompareSigns({
  exercise,
  input,
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<Extract<ExerciseInput, { kind: 'compare' }>>) {
  const [placed, setPlaced] = useState<string | null>(null);
  const [tried, setTried] = useState<readonly string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  // A sign then Enter typed before the next render: read the latest one here.
  const latest = useRef<string | null>(null);
  const place = (sign: string | null) => {
    if (locked || (sign !== null && tried.includes(sign))) return;
    latest.current = sign;
    setPlaced(sign);
  };
  const submit = () => {
    const sign = latest.current;
    if (locked || sign === null) return;
    latest.current = null;
    setPlaced(null);
    setLast(sign);
    setTried([...tried, sign]);
    onSubmit(sign);
  };
  const keys = useRef({ place, submit });
  keys.current = { place, submit };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const sign = SIGNS.find((s) => s === event.key) ?? SIGNS[Number(event.key) - 1];
      if (sign) keys.current.place(sign);
      else if (event.key === 'Backspace') keys.current.place(null);
      else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let between = placed;
  let state = placed ? 'placed' : 'empty';
  if (right) [between, state] = [last, 'right'];
  else if (shown !== null) [between, state] = [shown, 'shown'];
  return (
    <>
      <Work wide>
        <p class="statement large comparison" aria-label={exercise.statement}>
          <span class="number">{input.left}</span>
          <span class={`between ${state}`}>{between}</span>
          <span class="number">{input.right}</span>
        </p>
      </Work>
      <AnswerZone>
        <div class="choice signs">
          {SIGNS.map((sign) => {
            let mark = '';
            if (right && sign === last) mark = 'right';
            else if (sign === shown) mark = 'shown';
            else if (sign === placed) mark = 'placed';
            else if (tried.includes(sign)) mark = 'tried';
            return (
              <button
                key={sign}
                type="button"
                class={mark}
                disabled={locked && mark !== 'right' && mark !== 'shown'}
                onPointerDown={(event) => {
                  event.preventDefault();
                  place(sign);
                }}
              >
                {sign}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          class="submit"
          disabled={locked || placed === null}
          onPointerDown={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          ✓ Valider
        </button>
      </AnswerZone>
    </>
  );
}
