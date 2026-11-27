import { useEffect, useRef, useState } from 'preact/hooks';
import type { NumberLine } from '../../core/types';
import { AnswerZone, Statement, Work } from '../slate';
import { grouped } from './keypad';
import type { WidgetProps } from './index';

/** Width of the line in a `Work` beside the keypad, and in a `Work wide`. */
const NARROW = 430;
const WIDE = 760;
const HEIGHT = 150;
const PAD = 40;
const AXIS_Y = 84;

function ticks({ from, to, step }: NumberLine): number[] {
  return Array.from({ length: (to - from) / step + 1 }, (_, i) => from + i * step);
}

function tickX(line: NumberLine, value: number, width: number): number {
  return PAD + ((value - line.from) / (line.to - line.from)) * (width - 2 * PAD);
}

/** The tick closest to a point of the line, `x` in the units of the drawing. */
function closestTick(line: NumberLine, x: number, width: number): number {
  const count = (line.to - line.from) / line.step;
  const i = Math.round(((x - PAD) / (width - 2 * PAD)) * count);
  return line.from + Math.min(count, Math.max(0, i)) * line.step;
}

/** A pin standing on a tick: the arrow to read, or the one the child places. */
function Pin({ x, state }: { x: number; state: string }) {
  return (
    <g class={`pin ${state}`} transform={`translate(${x} ${AXIS_Y})`}>
      <path d="M0 -14 L-13 -38 A18 18 0 1 1 13 -38 Z" />
      <circle cy={-50} r={6} />
    </g>
  );
}

interface LineProps {
  line: NumberLine;
  width: number;
  pins: { value: number; state: string }[];
}

function Line({ line, width, pins }: LineProps) {
  return (
    <>
      <line class="axis" x1={PAD - 24} x2={width - PAD + 24} y1={AXIS_Y} y2={AXIS_Y} />
      {ticks(line).map((value) => {
        const x = tickX(line, value, width);
        const labelled = line.labels.includes(value);
        const size = labelled ? 16 : 11;
        return (
          <g key={value}>
            <line
              class={labelled ? 'tick labelled' : 'tick'}
              data-value={value}
              x1={x}
              x2={x}
              y1={AXIS_Y - size}
              y2={AXIS_Y + size}
            />
            {labelled && (
              <text x={x} y={AXIS_Y + 46}>
                {grouped(String(line.denominator ? value / line.denominator : value))}
              </text>
            )}
          </g>
        );
      })}
      {pins.map(({ value, state }) => (
        <Pin key={state} x={tickX(line, value, width)} state={state} />
      ))}
    </>
  );
}

/** The line to read, beside the keypad: an arrow on one tick, or a strip laid from its 0 to it. */
export function NumberLineFigure({
  line,
  arrow,
  strip = false,
}: {
  line: NumberLine;
  arrow: number;
  strip?: boolean;
}) {
  const start = tickX(line, line.from, NARROW);
  return (
    <svg class="number-line" viewBox={`0 0 ${NARROW} ${HEIGHT}`}>
      {strip && (
        <rect
          class="strip"
          x={start}
          y={AXIS_Y - 58}
          width={tickX(line, arrow, NARROW) - start}
          height={36}
          rx={4}
        />
      )}
      <Line line={line} width={NARROW} pins={strip ? [] : [{ value: arrow, state: 'arrow' }]} />
    </svg>
  );
}

/**
 * The child places a number with the finger: a touch or a slide puts the pin on the closest
 * tick, the button checks it. The pin does not tell its number. Keyboard: arrows, Enter.
 */
export function NumberLinePlace({
  exercise,
  input: { line },
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<{ kind: 'number-line'; line: NumberLine }>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const latest = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pick = (value: number) => {
    latest.current = value;
    setPicked(value);
  };
  const fromPointer = (event: PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    return closestTick(line, ((event.clientX - box.left) / box.width) * WIDE, WIDE);
  };
  const submit = () => {
    if (locked || latest.current === null) return;
    setSent(latest.current);
    onSubmit(String(latest.current));
  };
  const keys = useRef({ locked, submit });
  keys.current = { locked, submit };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keys.current.locked) return;
      const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (move !== undefined) {
        const start = latest.current ?? (line.from + line.to) / 2;
        pick(Math.min(line.to, Math.max(line.from, start + move * line.step)));
      } else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [line]);

  const pins: LineProps['pins'] = [];
  if (shown !== null) pins.push({ value: Number(shown), state: 'shown' });
  else if (picked !== null) {
    let state = 'placed';
    if (right) state = 'right';
    else if (picked === sent) state = 'tried';
    pins.push({ value: picked, state });
  }
  return (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
        <svg
          ref={svg}
          class="number-line place"
          viewBox={`0 0 ${WIDE} ${HEIGHT}`}
          onPointerDown={(event) => {
            if (locked) return;
            event.preventDefault();
            svg.current!.setPointerCapture(event.pointerId);
            pick(fromPointer(event));
          }}
          onPointerMove={(event) => {
            if (!locked && svg.current!.hasPointerCapture(event.pointerId))
              pick(fromPointer(event));
          }}
        >
          <rect class="touch" width={WIDE} height={HEIGHT} />
          <Line line={line} width={WIDE} pins={pins} />
        </svg>
      </Work>
      <AnswerZone>
        <button
          type="button"
          class="submit"
          disabled={locked || picked === null}
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
