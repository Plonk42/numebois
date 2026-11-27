import { useEffect, useRef, useState } from 'preact/hooks';
import type { Column, ExerciseInput } from '../../core/types';
import { AnswerZone, Work } from '../slate';
import { rankOf, useColumnSetup } from './column-setup';
import type { WidgetProps } from './index';
import { Keypad } from './keypad';

type ColumnInput = Extract<ExerciseInput, { kind: 'column' }>;

/** A box of the grid: the digit under the line, or the carry over a column. */
interface Spot {
  kind: 'digit' | 'carry';
  /** From the units. */
  column: number;
}

const keyOf = (spot: Spot) => `${spot.kind}${spot.column}`;
/** A demo writes a digit once the column is read, its carry soon after. */
const DEMO_DIGIT_MS = 2400;
const DEMO_CARRY_MS = 900;

/**
 * Where the cursor goes, from the units: the digit of each column, then its carry; a number
 * written whole (`joined` columns) from its left digit, as by hand (#164).
 */
function spotsOf(columns: readonly Column[]): Spot[] {
  const spots: Spot[] = [];
  let i = 0;
  while (i < columns.length) {
    let end = i;
    while (columns[end + 1]?.joined) end++;
    for (let j = end; j >= i; j--) spots.push({ kind: 'digit', column: j });
    if (columns[i].carry > 0 && end + 1 < columns.length) {
      spots.push({ kind: 'carry', column: end + 1 });
    }
    i = end + 1;
  }
  return spots;
}

/** The column whose calculation a column's digit comes from: joined ones from their right. */
function ownerOf(columns: readonly Column[], column: number): number {
  let at = column;
  while (columns[at]?.joined) at--;
  return at;
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
 * An operation set out in columns, units on the right (#48), the numbers first set out by the
 * child (#158, `useColumnSetup`). The cursor goes by itself from
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
  demo = false,
}: WidgetProps<ColumnInput>) {
  const { columns, rows } = input;
  // Played by itself, as Plume would guide it.
  const mode = demo ? 'guided' : input.mode;
  const spots = spotsOf(columns);
  const [values, setValues] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(0);
  /** Accompanied or guided: the box holding a digit that is not the one to write. */
  const [slip, setSlip] = useState<string | null>(null);
  /** Alone: the box of the first column that jams, with the digit sent. */
  const [jam, setJam] = useState<{ key: string; value: string } | null>(null);
  /** The table of the multiplier, shown on demand in place of the operation (#49). */
  const [table, setTable] = useState(false);
  // Fast typing comes before the next render: read and write the latest state here.
  const latest = useRef({ values, cursor });
  const slipped = useRef(false);
  const setup = useColumnSetup({ input, demo, locked, onSlip });
  const posing = !setup.posed.current;

  const move = (next: Record<string, string>, at: number) => {
    latest.current = { values: next, cursor: at };
    setValues(next);
    setCursor(at);
  };

  const write = (digit: string) => {
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
  const type = (digit: string) => {
    if (!setup.posed.current) setup.keys.type(digit);
    else if (!demo) write(digit);
  };

  const erase = () => {
    const { values: before, cursor: at } = latest.current;
    if (!setup.posed.current) {
      setup.keys.erase();
      return;
    }
    if (locked || demo) return;
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
    if (!setup.posed.current) {
      setup.keys.submit();
      return;
    }
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

  const keys = useRef({ type, write, erase, submit });
  keys.current = { type, write, erase, submit };
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

  // Plume writes each box in turn: time to read the column, less for its carry.
  useEffect(() => {
    if (!demo) return;
    let timer = 0;
    const next = () => {
      const spot = spots[latest.current.cursor];
      if (!spot) return;
      timer = window.setTimeout(
        () => {
          keys.current.write(expected(columns, spot));
          next();
        },
        spot.kind === 'digit' ? DEMO_DIGIT_MS : DEMO_CARRY_MS,
      );
    };
    next();
    return () => window.clearTimeout(timer);
  }, [demo]);

  const width = columns.length;
  const active = spots[cursor];
  const columnOf = (rank: number) => width - rank + 1;
  // A multiplication keeps its carry in the bag beside it, not over the columns (#49).
  const bagged = input.operator === '×';
  // A subtraction's carry goes down, under the bottom number in the next column (#173).
  const under = input.operator === '−';
  const top = bagged || under ? 2 : 3;
  const lineRow = rows.length + top + (under ? 1 : 0);
  const resultRow = lineRow + 1;
  // A price (#177): the comma after the euros, in every row, the result's too.
  const decimals = input.decimals ?? 0;
  const commaRows = decimals > 0 ? [...rows.map((_, row) => row + top), resultRow] : [];
  const carryRow = under ? rows.length + top : 2;
  const box = (spot: Spot, inBag = false) => {
    const key = keyOf(spot);
    let value = values[key] ?? '';
    let state = value ? 'filled' : 'empty';
    if (shown !== null) [value, state] = [inBag ? '' : expected(columns, spot), 'shown'];
    else if (right) [value, state] = [inBag ? '' : value, 'right'];
    else if (key === slip || (jam?.key === key && jam.value === value)) state = 'tried';
    if (!locked && active && keyOf(active) === key) state += ' cursor';
    const rank = spot.column;
    return (
      <button
        key={key}
        type="button"
        class={`box ${spot.kind} ${rankOf(rank, decimals).css} ${state}`}
        data-column={rank}
        style={
          inBag
            ? undefined
            : {
                gridColumn: columnOf(rank),
                gridRow: spot.kind === 'digit' ? resultRow : carryRow,
              }
        }
        disabled={locked || mode !== 'alone'}
        aria-label={
          inBag
            ? 'Sac à retenue'
            : `${spot.kind === 'digit' ? 'Chiffre' : 'Retenue'} des ${rankOf(rank, decimals).name}`
        }
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
  // The bag holds the carry the column in progress receives, or the one it sends.
  const owner = active ? ownerOf(columns, active.column) : -1;
  const bagSpot =
    spots.find((spot) => spot.kind === 'carry' && active && spot.column === owner) ?? null;

  const coach = active && !locked && !posing ? columns[sourceOf(active)] : null;
  let bubble: { title: string; text: string } | null = setup.bubble;
  if (coach && mode === 'guided') bubble = { title: coach.calc, text: coach.say };
  else if (coach && mode === 'accompanied' && slip !== null) {
    bubble = { title: 'Presque !', text: coach.calc };
  }
  const ranks = columns.map((_, rank) => rank);
  /**
   * By compensation, the top digit of a column that sends a carry gets 10 more: a small 1
   * before it, once its carry is written, or while Plume tells that column (guided, or after a
   * slip when accompanied).
   */
  const told = mode === 'guided' || (mode === 'accompanied' && slip !== null);
  const tenMore = (rank: number) =>
    under &&
    columns[rank].carry > 0 &&
    (shown !== null ||
      right ||
      values[`carry${rank + 1}`] === '1' ||
      (told && !posing && coach !== null && sourceOf(active) === rank));

  return (
    <>
      <Work>
        {table && (
          <ol class="table-of" aria-label={`La table de ${rows[1]}`}>
            {Array.from({ length: 10 }, (_, i) => (
              <li key={i}>
                {rows[1]} × {i + 1} = {rows[1] * (i + 1)}
              </li>
            ))}
          </ol>
        )}
        <div class="column-layout" hidden={table}>
          <div
            class="statement column-operation"
            aria-label={exercise.statement}
            style={{
              gridTemplateColumns: `44px repeat(${width}, ${under ? 76 : 68}px)`,
              gridTemplateRows: `30px ${bagged || under ? '' : '60px '}repeat(${rows.length}, 60px) ${under ? '60px ' : ''}6px 64px`,
            }}
          >
            {ranks.map((rank) => (
              <span
                key={`band-${rank}`}
                class={`band ${rankOf(rank, decimals).css}${coach && sourceOf(active) === rank ? ' active' : ''}`}
                style={{ gridColumn: columnOf(rank), gridRow: '1 / -1' }}
              />
            ))}
            {ranks.map((rank) => (
              <span
                key={`rank-${rank}`}
                class={`rank ${rankOf(rank, decimals).css}`}
                style={{ gridColumn: columnOf(rank), gridRow: 1 }}
              >
                {rankOf(rank, decimals).label}
              </span>
            ))}
            {!bagged &&
              !posing &&
              spots.filter((spot) => spot.kind === 'carry').map((spot) => box(spot))}
            {rows.slice(0, setup.termRows).flatMap((n, row) =>
              [...String(n)].reverse().map((digit, rank) => (
                <span
                  key={`term-${row}-${rank}`}
                  class="term"
                  style={{ gridColumn: columnOf(rank), gridRow: row + top }}
                >
                  {digit}
                </span>
              )),
            )}
            {!posing &&
              ranks.filter(tenMore).map((rank) => (
                <span
                  key={`ten-${rank}`}
                  class={`ten ${rankOf(rank, decimals).css}`}
                  style={{ gridColumn: columnOf(rank), gridRow: top }}
                >
                  1
                </span>
              ))}
            {commaRows.map((row) => (
              <span
                key={`comma-${row}`}
                class="comma"
                style={{ gridColumn: columnOf(decimals), gridRow: row }}
              >
                ,
              </span>
            ))}
            <span class="sign" style={{ gridColumn: 1, gridRow: rows.length + top - 1 }}>
              {input.operator}
            </span>
            <span class="line" style={{ gridColumn: '1 / -1', gridRow: lineRow }} />
            {posing
              ? setup.boxes((row, rank) => ({ gridColumn: columnOf(rank), gridRow: row + top }))
              : spots.filter((spot) => spot.kind === 'digit').map((spot) => box(spot))}
          </div>
          {bagged && (
            <div class="bag">
              <span>Sac</span>
              {bagSpot && !posing ? (
                box(bagSpot, true)
              ) : (
                <button type="button" class="box carry empty" disabled aria-label="Sac à retenue" />
              )}
            </div>
          )}
        </div>
        {bagged && (
          <button
            type="button"
            class="table-toggle"
            onPointerDown={(event) => {
              event.preventDefault();
              setTable(!table);
            }}
          >
            {table ? 'Revenir à l’opération' : `Voir la table de ${rows[1]}`}
          </button>
        )}
      </Work>
      {bubble && (
        <div class="hint coach">
          <strong>{bubble.title}</strong>
          <span>{bubble.text}</span>
        </div>
      )}
      <AnswerZone>
        <Keypad
          ready={posing ? setup.ready : ready}
          locked={locked || demo || (posing && !setup.typing)}
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
