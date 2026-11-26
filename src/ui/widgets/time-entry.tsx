import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { parseTime, timeText } from '../../core/time';
import type { ExerciseInput } from '../../core/types';
import { Keypad, type Key } from './keypad';
import type { WidgetProps } from './index';

const FIELDS = [
  { name: 'hours', unit: 'h', label: 'Heures' },
  { name: 'minutes', unit: 'min', label: 'Minutes' },
  { name: 'seconds', unit: 's', label: 'Secondes' },
] as const;
/** No hour has two digits starting above 2: a 3 goes straight on to the minutes. */
const MAX_HOURS = 23;

/**
 * A time written in its boxes (#55), as at school: « 14h10 », or « 3h45min20s ». The hours box
 * is orange like the hour hand, the minutes box blue like the minute hand. A touch on a box
 * empties it to write it again; the cursor goes on by itself when a box is full.
 * Keyboard: digits, Backspace, Enter, `h` or the arrows from box to box.
 */
export function TimeEntry({
  input,
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<Extract<ExerciseInput, { kind: 'time' }>>) {
  const fields = input.seconds ? FIELDS : FIELDS.slice(0, 2);
  const [values, setValues] = useState<string[]>(fields.map(() => ''));
  const [active, setActive] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  // Fast typing comes before the next render: read and write the latest state here.
  const latest = useRef({ values, active });
  const update = (next: string[], at: number) => {
    latest.current = { values: next, active: at };
    setValues(next);
    setActive(at);
  };
  const answerOf = (boxes: readonly string[]) =>
    timeText({
      hours: Number(boxes[0]),
      minutes: Number(boxes[1]),
      ...(input.seconds ? { seconds: Number(boxes[2]) } : {}),
    });

  const press = (key: Key | 'next' | 'previous') => {
    if (locked) return;
    const { values: now, active: at } = latest.current;
    if (key === 'submit') {
      if (now[0] === '') return;
      const answer = answerOf(now);
      setSent(answer);
      onSubmit(answer);
      return;
    }
    if (key === 'next') return update(now, Math.min(at + 1, fields.length - 1));
    if (key === 'previous') return update(now, Math.max(at - 1, 0));
    const next = [...now];
    if (key === 'erase') {
      if (now[at] === '' && at > 0) {
        next[at - 1] = now[at - 1].slice(0, -1);
        return update(next, at - 1);
      }
      next[at] = now[at].slice(0, -1);
      return update(next, at);
    }
    // A full box starts again.
    const value = now[at].length >= 2 ? key : now[at] + key;
    next[at] = value;
    const full = value.length === 2 || (at === 0 && Number(value) * 10 > MAX_HOURS);
    update(next, full ? Math.min(at + 1, fields.length - 1) : at);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;
      if (/^\d$/.test(key)) pressRef.current(key as Key);
      else if (key === 'Backspace') pressRef.current('erase');
      else if (key === 'Enter') pressRef.current('submit');
      else if (key === 'h' || key === ':' || key === 'ArrowRight') pressRef.current('next');
      else if (key === 'ArrowLeft') pressRef.current('previous');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shownTime = shown === null ? null : parseTime(shown);
  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  const boxes = shownTime
    ? [String(shownTime.hours), pad(shownTime.minutes), pad(shownTime.seconds)]
    : values;
  let state = '';
  if (right) state = ' right';
  else if (shownTime) state = ' shown';
  else if (sent !== null && sent === answerOf(values)) state = ' tried';
  return (
    <>
      <div
        class={`time-entry${input.seconds ? ' with-seconds' : ''}`}
        aria-label={shown === null ? 'Ta réponse' : 'La réponse'}
      >
        {fields.map((field, i) => (
          <Fragment key={field.name}>
            <button
              type="button"
              class={`box ${field.name}${state}${!state && i === active && !locked ? ' active' : ''}`}
              aria-label={field.label}
              disabled={locked}
              onPointerDown={(event) => {
                event.preventDefault();
                if (locked) return;
                const next = [...latest.current.values];
                next[i] = '';
                update(next, i);
              }}
            >
              {boxes[i]}
            </button>
            {/* « 14h10 »: the minutes need no unit, unless a duration or the seconds. */}
            {(field.name !== 'minutes' || input.seconds || input.duration) && (
              <span class="unit">{field.unit}</span>
            )}
          </Fragment>
        ))}
      </div>
      <Keypad ready={values[0] !== ''} locked={locked} press={press} />
    </>
  );
}
