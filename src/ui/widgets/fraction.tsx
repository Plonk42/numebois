import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExerciseInput, Whole, WholeShape } from '../../core/types';
import { AnswerZone, Statement, Work } from '../slate';
import { Keypad, type Key } from './keypad';
import type { WidgetProps } from './index';

/** Room for a whole, in pixels of the drawing. */
interface Room {
  w: number;
  h: number;
}

/** A bar of chocolate: as many rows as fit under the square root, `parts` squares in all. */
function grid(parts: number): [rows: number, columns: number] {
  let rows = Math.floor(Math.sqrt(parts));
  while (parts % rows !== 0) rows--;
  return [rows, parts / rows];
}

function size(shape: WholeShape, parts: number, room: Room): Room {
  if (shape === 'disc' || shape === 'log') {
    const s = Math.min(room.w, room.h);
    return { w: s, h: s };
  }
  if (shape === 'strip') return room;
  const [rows, columns] = grid(parts);
  const cell = Math.min(room.w / columns, room.h / rows);
  return { w: cell * columns, h: cell * rows };
}

/** The outline of each part, in the drawing's pixels, from the top, clockwise for a disc. */
function partPaths(shape: WholeShape, parts: number, { w, h }: Room): string[] {
  const pad = 4;
  if (shape === 'disc' || shape === 'log') {
    const r = w / 2 - pad - (shape === 'log' ? 6 : 0);
    const point = (i: number) => {
      const angle = (i / parts) * 2 * Math.PI - Math.PI / 2;
      return `${(w / 2 + r * Math.cos(angle)).toFixed(2)} ${(h / 2 + r * Math.sin(angle)).toFixed(2)}`;
    };
    return Array.from(
      { length: parts },
      (_, i) => `M${w / 2} ${h / 2} L${point(i)} A${r} ${r} 0 0 1 ${point(i + 1)} Z`,
    );
  }
  const [rows, columns] = shape === 'strip' ? [1, parts] : grid(parts);
  const cw = (w - 2 * pad) / columns;
  const ch = (h - 2 * pad) / rows;
  return Array.from({ length: parts }, (_, i) => {
    const x = pad + (i % columns) * cw;
    const y = pad + Math.floor(i / columns) * ch;
    return `M${x.toFixed(2)} ${y.toFixed(2)} h${cw.toFixed(2)} v${ch.toFixed(2)} h${(-cw).toFixed(2)} Z`;
  });
}

interface WholeProps {
  shape: WholeShape;
  parts: number;
  room: Room;
  /** A class per part: `coloured`, `added`, `on`, `tried`, `right`, `shown`, or none. */
  marks: readonly string[];
  /** A touch on a part, when the child colours them. */
  onPart?: (part: number) => void;
}

/** A whole shared in equal parts: a galette, a strip, a bar of chocolate, a slice of log. */
export function WholeView({ shape, parts, room, marks, onPart }: WholeProps) {
  const { w, h } = size(shape, parts, room);
  const r = w / 2 - 4;
  return (
    <svg
      class={`whole ${shape}${onPart ? ' touch' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
    >
      {shape === 'log' && <circle class="bark" cx={w / 2} cy={h / 2} r={r} />}
      {partPaths(shape, parts, { w, h }).map((d, i) => (
        <path
          key={i}
          class={`part ${marks[i] ?? ''}`}
          data-part={i}
          d={d}
          onPointerDown={
            onPart &&
            ((event) => {
              event.preventDefault();
              onPart(i);
            })
          }
        />
      ))}
      {shape === 'log' &&
        [0.25, 0.5, 0.75].map((k) => (
          <circle key={k} class="ring" cx={w / 2} cy={h / 2} r={(r - 6) * k} />
        ))}
    </svg>
  );
}

/** The classes of a whole drawn in a figure: its coloured parts, then the added ones. */
const figureMarks = ({ parts, coloured, added = 0 }: Whole) =>
  Array.from({ length: parts }, (_, i) => {
    if (i < coloured) return 'coloured';
    return i < coloured + added ? 'added' : '';
  });

/** Wholes to look at, side by side, or strips one under the other so their parts line up. */
export function FractionFigure({ wholes }: { wholes: readonly Whole[] }) {
  const strips = wholes.every((whole) => whole.shape === 'strip');
  let room: Room = { w: 360, h: 250 };
  if (strips) room = { w: 400, h: wholes.length > 1 ? 72 : 88 };
  else if (wholes.length > 1) room = { w: 190, h: 190 };
  return (
    <div class={`fraction-figure${strips ? ' strips' : ''}`}>
      {wholes.map((whole, i) => (
        <WholeView
          key={i}
          shape={whole.shape}
          parts={whole.parts}
          room={room}
          marks={figureMarks(whole)}
        />
      ))}
    </div>
  );
}

/**
 * The child colours parts of a whole with the finger (#61): a touch colours a part, another
 * one takes the colour off; the button checks how many. Keyboard: the arrows colour one part
 * more or less, Enter.
 */
export function PartsColour({
  exercise,
  input: { shape, parts },
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<Extract<ExerciseInput, { kind: 'parts' }>>) {
  const [on, setOn] = useState<readonly boolean[]>(() => new Array<boolean>(parts).fill(false));
  const [sent, setSent] = useState<readonly boolean[] | null>(null);
  const latest = useRef(on);
  const update = (next: readonly boolean[]) => {
    latest.current = next;
    setOn(next);
  };
  const count = on.filter(Boolean).length;
  const submit = () => {
    const now = latest.current;
    const coloured = now.filter(Boolean).length;
    if (locked || coloured === 0) return;
    setSent(now);
    onSubmit(String(coloured));
  };
  const keys = useRef({ locked, submit });
  keys.current = { locked, submit };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keys.current.locked) return;
      const move = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (move !== undefined) {
        const next = Math.min(parts, Math.max(0, latest.current.filter(Boolean).length + move));
        update(Array.from({ length: parts }, (_, i) => i < next));
      } else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parts]);

  const tried = sent !== null && sent.every((value, i) => value === on[i]);
  let marks: string[];
  if (shown !== null) {
    marks = Array.from({ length: parts }, (_, i) => (i < Number(shown) ? 'shown' : ''));
  } else {
    let state = 'on';
    if (right) state = 'right';
    else if (tried) state = 'tried';
    marks = on.map((value) => (value ? state : ''));
  }
  const room = shape === 'strip' ? { w: 720, h: 110 } : { w: 640, h: 300 };
  return (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
        <WholeView
          shape={shape}
          parts={parts}
          room={room}
          marks={marks}
          onPart={
            locked
              ? undefined
              : (part) => update(latest.current.map((value, i) => (i === part ? !value : value)))
          }
        />
      </Work>
      <AnswerZone>
        <button
          type="button"
          class="submit"
          disabled={locked || count === 0}
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

const BOXES = [
  { name: 'numerator', label: 'Numérateur' },
  { name: 'denominator', label: 'Dénominateur' },
] as const;

/** No fraction of the game has a number above 12: a first digit from 2 is a whole number. */
const full = (value: string) => value.length === 2 || Number(value) >= 2;

/**
 * A fraction written in its two boxes (#61), the numerator over the denominator, with the
 * keypad. A touch on a box empties it; the cursor goes down by itself when the numerator is
 * written, and ✓ goes to the denominator while it is empty. Keyboard: digits, Backspace, Enter,
 * `/` or the arrows from box to box.
 */
export function FractionEntry({
  locked,
  right,
  shown,
  onSubmit,
}: Pick<WidgetProps, 'locked' | 'right' | 'shown' | 'onSubmit'>) {
  const [values, setValues] = useState<string[]>(['', '']);
  const [active, setActive] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const latest = useRef({ values, active });
  const update = (next: string[], at: number) => {
    latest.current = { values: next, active: at };
    setValues(next);
    setActive(at);
  };
  const answerOf = (boxes: readonly string[]) => `${Number(boxes[0])}/${Number(boxes[1])}`;

  const press = (key: Key | 'next' | 'previous') => {
    if (locked) return;
    const { values: now, active: at } = latest.current;
    if (key === 'submit') {
      if (now[0] === '') return;
      if (now[1] === '') return update(now, 1);
      const answer = answerOf(now);
      setSent(answer);
      onSubmit(answer);
      return;
    }
    if (key === 'next') return update(now, 1);
    if (key === 'previous') return update(now, 0);
    const next = [...now];
    if (key === 'erase') {
      if (now[at] === '' && at > 0) {
        next[0] = now[0].slice(0, -1);
        return update(next, 0);
      }
      next[at] = now[at].slice(0, -1);
      return update(next, at);
    }
    const value = now[at].length >= 2 ? key : now[at] + key;
    next[at] = value;
    update(next, at === 0 && full(value) ? 1 : at);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;
      if (/^\d$/.test(key)) pressRef.current(key as Key);
      else if (key === 'Backspace') pressRef.current('erase');
      else if (key === 'Enter') pressRef.current('submit');
      else if (key === '/' || key === 'ArrowDown') pressRef.current('next');
      else if (key === 'ArrowUp') pressRef.current('previous');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const boxes = shown === null ? values : shown.split('/');
  let state = '';
  if (right) state = ' right';
  else if (shown !== null) state = ' shown';
  else if (sent !== null && values[1] !== '' && sent === answerOf(values)) state = ' tried';
  return (
    <>
      <div class="fraction-entry" aria-label={shown === null ? 'Ta réponse' : 'La réponse'}>
        {BOXES.map((box, i) => (
          <button
            key={box.name}
            type="button"
            class={`box ${box.name}${state}${!state && i === active && !locked ? ' active' : ''}`}
            aria-label={box.label}
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
        ))}
      </div>
      <Keypad ready={values[0] !== ''} locked={locked} press={press} />
    </>
  );
}
