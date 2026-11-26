import { useRef, useState } from 'preact/hooks';
import type { ExerciseInput } from '../../core/types';

type ColumnInput = Extract<ExerciseInput, { kind: 'column' }>;

/** Over the columns, from the units, coloured as in the place-value table. */
export const RANKS = ['U', 'D', 'C', 'M'];
export const NAMES = ['unités', 'dizaines', 'centaines', 'milliers'];

/** Thousands apart, as in the statement (numbers up to 9 999). */
const grouped = (n: number) =>
  n < 1000 ? String(n) : `${Math.floor(n / 1000)}\u00a0${String(n % 1000).padStart(3, '0')}`;
/** Its digits from the units: the digit of each rank when set out right. */
const digitsOf = (n: number) => [...String(n)].reverse();
const keyOf = (row: number, rank: number) => `${row}:${rank}`;

interface Place {
  row: number;
  rank: number;
}

export interface Bubble {
  title: string;
  text: string;
}

interface Options {
  input: ColumnInput;
  /** Played by itself: already set out. */
  demo: boolean;
  locked: boolean;
  onSlip?: () => void;
}

const aligned = (n: number) => `Les unités sous les unités : le ${String(n).at(-1)} va sous le U.`;

/** With a touch: where the number starts; set out wrong (`tried`), the rule. */
function tapBubble(n: number, guided: boolean, tried: boolean): Bubble {
  const digits = String(n);
  if (tried) return { title: 'Presque !', text: aligned(n) };
  const title = digits.length > 1 ? `Où commence ${grouped(n)} ?` : `Où va le ${n} ?`;
  if (digits.length === 1)
    return { title, text: guided ? 'Il va sous le U : touche sa case.' : 'Touche sa case.' };
  return {
    title,
    text: guided
      ? `Le ${digits.at(-1)} va sous le U : touche la case du ${digits[0]}.`
      : `Touche la case de son premier chiffre, le ${digits[0]}.`,
  };
}

/** Written: the numbers to set out; the first set out wrong (`written` as it is), what jams. */
function writeBubble(input: ColumnInput, jam: number | null, written: string): Bubble {
  if (jam === null) {
    const sign = `\u00a0${input.operator} `;
    return {
      title: `Pose ${input.rows.map(grouped).join(sign)}.`,
      text: 'Écris chaque nombre sur sa ligne, puis appuie sur ✓.',
    };
  }
  const n = input.rows[jam];
  return {
    title: 'Presque !',
    text: written === String(n) ? aligned(n) : `Regarde bien les chiffres de ${grouped(n)}.`,
  };
}

/**
 * The numbers set out in the grid before the operation is worked out (#158). With a touch,
 * the child touches the box where a number starts and it writes itself, set out again at once
 * if it is not right. Written, the child fills the boxes one by one (a touch, then a digit; the
 * cursor goes right), then ✓: the first number set out wrong is shown gently.
 */
export function useColumnSetup({ input, demo, locked, onSlip }: Options) {
  const { rows, columns, setup } = input;
  const width = columns.length;
  // Read by the keys before the next render: fast typing goes on with the operation at once.
  const posed = useRef(demo || !setup);
  const [, setPosed] = useState(posed.current);
  /** With a touch: the number being set out, and where it was set out wrong. */
  const [row, setRow] = useState(0);
  const [tried, setTried] = useState<number | null>(null);
  /** Written: the digits in their boxes, and the number shown set out wrong. */
  const [values, setValues] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<Place | null>(null);
  const [jam, setJam] = useState<number | null>(null);
  const latest = useRef({ values, cursor });
  const slipped = useRef(false);

  const slip = () => {
    if (slipped.current) return;
    slipped.current = true;
    onSlip?.();
  };
  const done = () => {
    posed.current = true;
    setPosed(true);
  };
  const move = (next: Record<string, string>, at: Place | null) => {
    latest.current = { values: next, cursor: at };
    setValues(next);
    setCursor(at);
  };

  const touch = (place: Place) => {
    if (locked || posed.current) return;
    if (setup === 'write') {
      move(latest.current.values, place);
      return;
    }
    if (place.row !== row) return;
    if (place.rank !== String(rows[row]).length - 1) {
      setTried(place.rank);
      slip();
      return;
    }
    setTried(null);
    if (row + 1 === rows.length) done();
    else setRow(row + 1);
  };

  const type = (digit: string) => {
    const { values: before, cursor: at } = latest.current;
    if (locked || posed.current || setup !== 'write' || !at) return;
    const next = { ...before, [keyOf(at.row, at.rank)]: digit };
    move(next, at.rank > 0 ? { row: at.row, rank: at.rank - 1 } : null);
  };

  const erase = () => {
    const { values: before, cursor: at } = latest.current;
    if (locked || posed.current || setup !== 'write' || !at) return;
    const here = keyOf(at.row, at.rank);
    const without = (key: string) =>
      Object.fromEntries(Object.entries(before).filter(([k]) => k !== key));
    if (before[here] !== undefined) move(without(here), at);
    else if (at.rank + 1 < width) {
      const left = { row: at.row, rank: at.rank + 1 };
      move(without(keyOf(left.row, left.rank)), left);
    }
  };

  const ranks = Array.from({ length: width }, (_, rank) => rank);
  const wrongIn = (now: Record<string, string>, r: number) => {
    const digits = digitsOf(rows[r]);
    return ranks.filter((rank) => now[keyOf(r, rank)] !== digits[rank]);
  };
  const ready =
    setup === 'write' &&
    !posed.current &&
    rows.every((_, r) => ranks.some((rank) => values[keyOf(r, rank)] !== undefined));

  const submit = () => {
    const { values: now } = latest.current;
    if (locked || posed.current || setup !== 'write') return;
    if (!rows.every((_, r) => ranks.some((rank) => now[keyOf(r, rank)] !== undefined))) return;
    const first = rows.findIndex((_, r) => wrongIn(now, r).length > 0);
    if (first < 0) {
      setJam(null);
      move(now, null);
      done();
      return;
    }
    setJam(first);
    // After its last digit, as after typing: the eraser takes the digits back from the right.
    const end = Math.min(...ranks.filter((rank) => now[keyOf(first, rank)] !== undefined));
    move(now, { row: first, rank: Math.max(end - 1, 0) });
    slip();
  };

  let bubble: Bubble | null = null;
  if (!posed.current && setup === 'tap') {
    bubble = tapBubble(rows[row], input.mode === 'guided', tried !== null);
  } else if (!posed.current && setup === 'write') {
    const written =
      jam === null
        ? ''
        : ranks
            .map((rank) => values[keyOf(jam, rank)] ?? '')
            .reverse()
            .join('');
    bubble = writeBubble(input, jam, written);
  }

  /** The boxes of the numbers, placed in the grid by `at`, while they are set out. */
  const boxes = (at: (row: number, rank: number) => { gridColumn: number; gridRow: number }) =>
    rows.flatMap((n, r) => {
      if (setup === 'tap' && r !== row) return [];
      const digits = digitsOf(n);
      return ranks.map((rank) => {
        let value = '';
        let state = 'empty';
        if (setup === 'tap' && tried !== null) {
          // Set out from the box touched: shown where it lands.
          value = digits[rank - (tried - digits.length + 1)] ?? '';
          if (value) state = 'tried';
        } else if (setup === 'write') {
          value = values[keyOf(r, rank)] ?? '';
          if (value) state = 'filled';
          if (jam === r && wrongIn(values, r).includes(rank) && value) state = 'tried';
          if (!locked && cursor?.row === r && cursor.rank === rank) state += ' cursor';
        }
        return (
          <button
            key={`set-${r}-${rank}`}
            type="button"
            class={`box term r${rank} ${state}`}
            style={at(r, rank)}
            disabled={locked}
            aria-label={`Ligne ${r + 1}, ${NAMES[rank]}`}
            onPointerDown={(event) => {
              event.preventDefault();
              touch({ row: r, rank });
            }}
          >
            {value}
          </button>
        );
      });
    });

  /** The numbers shown as set out: with a touch, those already done; written, none until all are. */
  let termRows = rows.length;
  if (!posed.current) termRows = setup === 'tap' ? row : 0;

  return {
    posed,
    /** No keypad while numbers are set out with a touch. */
    typing: setup === 'write',
    ready,
    bubble,
    boxes,
    termRows,
    keys: { type, erase, submit },
  };
}
