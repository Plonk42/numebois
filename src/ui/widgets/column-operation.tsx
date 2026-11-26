import { useEffect, useRef, useState } from 'preact/hooks';
import type { Column, ExerciseInput } from '../../core/types';
import { AnswerZone, Work } from '../slate';
import type { WidgetProps } from './index';
import { Keypad } from './keypad';

type ColumnInput = Extract<ExerciseInput, { kind: 'column' }>;

/** A box of the grid: the digit under the line, or the carry over a column. */
interface Spot {
  kind: 'digit' | 'carry';
  /** From the units. */
  column: number;
}

/** Over the columns, from the units, coloured as in the place-value table. */
const RANKS = ['U', 'D', 'C', 'M'];
const NAMES = ['unités', 'dizaines', 'centaines', 'milliers'];
const keyOf = (spot: Spot) => `${spot.kind}${spot.column}`;

/** Where the cursor goes, from the units: the digit of each column, then its carry. */
function spotsOf(columns: readonly Column[]): Spot[] {
  return columns.flatMap((column, i): Spot[] =>
    column.carry > 0 && i + 1 < columns.length
      ? [
          { kind: 'digit', column: i },
          { kind: 'carry', column: i + 1 },
        ]
      : [{ kind: 'digit', column: i }],
  );
}

/** The column a box belongs to: a carry comes from the column on its right. */
const sourceOf = (spot: Spot) => (spot.kind === 'digit' ? spot.column : spot.column - 1);

function expected(columns: readonly Column[], spot: Spot): string {
  const column = columns[sourceOf(spot)];
  return String(spot.kind === 'digit' ? column.digit : column.carry);
}

/** The result as written under the line, empty boxes left out. */
function resultOf(columns: readonly Column[], values: Record<string, string>): string {
  return columns
    .map((_, i) => values[`digit${i}`] ?? '')
    .reverse()
    .join('');
}

/**
 * An operation set out in columns, units on the right (#48). The cursor goes by itself from
 * the units, the digit of a column then its carry; the keypad writes in it. Guided, Plume tells
 * the column; accompanied, a column is checked as it is written, its calculation shown at a
 * slip; alone, the result is checked at the end, the first column that jams shown gently, and
 * a touch on a box moves the cursor. Computed by the module: the widget only shows.
 */
export function ColumnOperation({
  exercise,
  input,
  locked,
  right,
  shown,
  onSubmit,
  onSlip,
}: WidgetProps<ColumnInput>) {
  const { columns, rows, mode } = input;
  const spots = spotsOf(columns);
  const [values, setValues] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(0);
  /** Accompanied or guided: the box holding a digit that is not the one to write. */
  const [slip, setSlip] = useState<string | null>(null);
  /** Alone: the box of the first column that jams, with the digit sent. */
  const [jam, setJam] = useState<{ key: string; value: string } | null>(null);
  // Fast typing comes before the next render: read and write the latest state here.
  const latest = useRef({ values, cursor });
  const slipped = useRef(false);

  const move = (next: Record<string, string>, at: number) => {
    latest.current = { values: next, cursor: at };
    setValues(next);
    setCursor(at);
  };

  const type = (digit: string) => {
    const { values: before, cursor: at } = latest.current;
    const spot = spots[at];
    if (locked || !spot) return;
    const key = keyOf(spot);
    const next = { ...before, [key]: digit };
    if (mode === 'alone') {
      move(next, at + 1);
      return;
    }
    if (digit !== expected(columns, spot)) {
      move(next, at);
      setSlip(key);
      if (mode === 'accompanied' && !slipped.current) {
        slipped.current = true;
        onSlip?.();
      }
      return;
    }
    setSlip(null);
    move(next, at + 1);
    if (at + 1 === spots.length) onSubmit(resultOf(columns, next));
  };

  const erase = () => {
    const { values: before, cursor: at } = latest.current;
    if (locked) return;
    const here = spots[at];
    const without = (spot: Spot) =>
      Object.fromEntries(Object.entries(before).filter(([key]) => key !== keyOf(spot)));
    if (here && before[keyOf(here)] !== undefined) {
      move(without(here), at);
      setSlip(null);
      return;
    }
    if (mode !== 'alone' || at === 0) return;
    move(without(spots[at - 1]), at - 1);
  };

  const ready = mode === 'alone' && columns.every((_, i) => values[`digit${i}`] !== undefined);
  const submit = () => {
    const { values: now } = latest.current;
    if (locked || mode !== 'alone' || columns.some((_, i) => now[`digit${i}`] === undefined)) {
      return;
    }
    const first = columns.findIndex((column, i) => now[`digit${i}`] !== String(column.digit));
    if (first >= 0) {
      const key = `digit${first}`;
      setJam({ key, value: now[key] });
      move(
        now,
        spots.findIndex((spot) => keyOf(spot) === key),
      );
    }
    onSubmit(resultOf(columns, now));
  };

  const keys = useRef({ type, erase, submit });
  keys.current = { type, erase, submit };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) keys.current.type(event.key);
      else if (event.key === 'Backspace') keys.current.erase();
      else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const width = columns.length;
  const active = spots[cursor];
  const columnOf = (rank: number) => width - rank + 1;
  const resultRow = rows.length + 4;
  const box = (spot: Spot) => {
    const key = keyOf(spot);
    let value = values[key] ?? '';
    let state = value ? 'filled' : 'empty';
    if (shown !== null) [value, state] = [expected(columns, spot), 'shown'];
    else if (right) state = 'right';
    else if (key === slip || (jam?.key === key && jam.value === value)) state = 'tried';
    if (!locked && active && keyOf(active) === key) state += ' cursor';
    const rank = spot.column;
    return (
      <button
        key={key}
        type="button"
        class={`box ${spot.kind} r${rank} ${state}`}
        style={{ gridColumn: columnOf(rank), gridRow: spot.kind === 'digit' ? resultRow : 2 }}
        disabled={locked || mode !== 'alone'}
        aria-label={`${spot.kind === 'digit' ? 'Chiffre' : 'Retenue'} des ${NAMES[rank]}`}
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || mode !== 'alone') return;
          move(
            latest.current.values,
            spots.findIndex((s) => keyOf(s) === key),
          );
        }}
      >
        {value}
      </button>
    );
  };

  const coach = active && !locked ? columns[sourceOf(active)] : null;
  let bubble: { title: string; text: string } | null = null;
  if (coach && mode === 'guided') bubble = { title: coach.calc, text: coach.say };
  else if (coach && mode === 'accompanied' && slip !== null) {
    bubble = { title: 'Presque !', text: coach.calc };
  }
  const ranks = columns.map((_, rank) => rank);

  return (
    <>
      <Work>
        <div
          class="statement column-operation"
          aria-label={exercise.statement}
          style={{
            gridTemplateColumns: `44px repeat(${width}, 68px)`,
            gridTemplateRows: `30px 60px repeat(${rows.length}, 50px) 6px 64px`,
          }}
        >
          {ranks.map((rank) => (
            <span
              key={`band-${rank}`}
              class={`band r${rank}${coach && sourceOf(active) === rank ? ' active' : ''}`}
              style={{ gridColumn: columnOf(rank), gridRow: '1 / -1' }}
            />
          ))}
          {ranks.map((rank) => (
            <span
              key={`rank-${rank}`}
              class={`rank r${rank}`}
              style={{ gridColumn: columnOf(rank), gridRow: 1 }}
            >
              {RANKS[rank]}
            </span>
          ))}
          {spots.filter((spot) => spot.kind === 'carry').map(box)}
          {rows.flatMap((n, row) =>
            [...String(n)].reverse().map((digit, rank) => (
              <span
                key={`term-${row}-${rank}`}
                class="term"
                style={{ gridColumn: columnOf(rank), gridRow: row + 3 }}
              >
                {digit}
              </span>
            )),
          )}
          <span class="sign" style={{ gridColumn: 1, gridRow: rows.length + 2 }}>
            {input.operator}
          </span>
          <span class="line" style={{ gridColumn: '1 / -1', gridRow: rows.length + 3 }} />
          {spots.filter((spot) => spot.kind === 'digit').map(box)}
        </div>
      </Work>
      {bubble && (
        <div class="hint coach">
          <strong>{bubble.title}</strong>
          <span>{bubble.text}</span>
        </div>
      )}
      <AnswerZone>
        <Keypad
          ready={ready}
          locked={locked}
          press={(key) => {
            if (key === 'submit') submit();
            else if (key === 'erase') erase();
            else type(key);
          }}
        />
      </AnswerZone>
    </>
  );
}
