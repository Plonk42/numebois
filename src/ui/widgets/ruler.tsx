import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  RULER_BEFORE_MM,
  RULER_MM,
  SHEET,
  type Point,
  type Pose,
  type Segment,
} from '../../core/sheet';
import type { ExerciseInput } from '../../core/types';
import { AnswerZone, Statement, Work } from '../slate';
import { Answer, Keypad, useEntry } from './keypad';
import type { WidgetProps } from './index';

/** The ruler in millimetres: its body around the graduations, the round handle that turns it. */
const BEFORE = RULER_BEFORE_MM;
const AFTER = 6;
const HEIGHT = 16;
const KNOB = { x: RULER_MM + AFTER + 7, y: HEIGHT / 2, r: 6.5 };
/** The 0 of the ruler jumps onto a point this close (mm), its edge onto a segment (degrees). */
const SNAP_MM = 3;
const SNAP_DEGREES = 6;

const degrees = (rad: number) => (rad * 180) / Math.PI;
const KNOB_ANGLE = degrees(Math.atan2(KNOB.y, KNOB.x));

function toSheet(svg: SVGSVGElement, event: PointerEvent): Point {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    svg.getScreenCTM()!.inverse(),
  );
  return { x: point.x, y: point.y };
}

/** The ruler moved so its 0 is at `to`, onto a point if one is close (child-ux: magnets). */
function moved(pose: Pose, to: Point, points: readonly Point[]): Pose {
  const near = points.find((p) => Math.hypot(p.x - to.x, p.y - to.y) <= SNAP_MM);
  const x = Math.min(SHEET.width, Math.max(0, (near ?? to).x));
  const y = Math.min(SHEET.height, Math.max(0, (near ?? to).y));
  return { ...pose, x, y };
}

/** The ruler turned towards `to` around its 0, onto a segment that starts there if one is close. */
function turned(pose: Pose, to: Point, lines: readonly Segment[]): Pose {
  let angle = degrees(Math.atan2(to.y - pose.y, to.x - pose.x)) - KNOB_ANGLE;
  for (const { from, to: end } of lines) {
    for (const [a, b] of [
      [from, end],
      [end, from],
    ]) {
      if (Math.hypot(a.x - pose.x, a.y - pose.y) > 0.01) continue;
      const along = degrees(Math.atan2(b.y - a.y, b.x - a.x));
      const gap = ((along - angle + 540) % 360) - 180;
      if (Math.abs(gap) <= SNAP_DEGREES) angle = along;
    }
  }
  return { ...pose, angle: Math.round(angle * 100) / 100 };
}

function Ruler({ pose }: { pose: Pose }) {
  const ticks = Array.from({ length: RULER_MM + 1 }, (_, mm) => mm);
  return (
    <g class="ruler" transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle})`}>
      <rect
        class="ruler-body"
        x={-BEFORE}
        y={0}
        width={RULER_MM + BEFORE + AFTER}
        height={HEIGHT}
        rx={1.5}
      />
      {ticks.map((mm) => {
        let length = 2.4;
        if (mm % 10 === 0) length = 5;
        else if (mm % 5 === 0) length = 3.6;
        return (
          <line key={mm} class={mm % 10 === 0 ? 'cm' : ''} x1={mm} x2={mm} y1={0} y2={length} />
        );
      })}
      {ticks
        .filter((mm) => mm % 10 === 0)
        .map((mm) => (
          <text key={mm} x={mm} y={9.6}>
            {mm / 10}
          </text>
        ))}
      <g class="knob">
        <circle cx={KNOB.x} cy={KNOB.y} r={KNOB.r} />
        <path d={`M${KNOB.x - 3} ${KNOB.y + 1.5} A3.2 3.2 0 1 1 ${KNOB.x + 2.4} ${KNOB.y + 2.2}`} />
      </g>
    </g>
  );
}

interface SheetProps {
  lines: readonly Segment[];
  /** Points the 0 of the ruler jumps onto. */
  points: readonly Point[];
  start: Pose;
  locked: boolean;
  /** A touch out of the ruler (drawing a segment). */
  onPaper?(point: Point, first: boolean): void;
  /** The ruler moved or turned. */
  onPose?(pose: Pose): void;
  class: string;
  data?: Record<string, string>;
  children?: ComponentChildren;
}

/**
 * The sheet with its segments and the ruler (#57): the ruler slides under the finger, its 0
 * jumps onto a point close to it; the round handle at its end turns it around its 0, its edge
 * laid on a segment when close. The ruler is see-through, the segments show under it.
 */
function Sheet({
  lines,
  points,
  start,
  locked,
  onPaper,
  onPose,
  class: name,
  data,
  children,
}: SheetProps) {
  const [pose, setPose] = useState(start);
  const latest = useRef(start);
  const drag = useRef<{ mode: 'move' | 'turn' | 'paper'; offset: Point } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const set = (next: Pose) => {
    latest.current = next;
    setPose(next);
    onPose?.(next);
  };
  const follow = (point: Point, first: boolean) => {
    const now = drag.current;
    if (!now) return;
    if (now.mode === 'turn') set(turned(latest.current, point, lines));
    else if (now.mode === 'move') {
      set(moved(latest.current, { x: point.x - now.offset.x, y: point.y - now.offset.y }, points));
    } else onPaper?.(point, first);
  };
  return (
    <svg
      ref={svg}
      class={`sheet ${name}`}
      viewBox={`0 0 ${SHEET.width} ${SHEET.height}`}
      role="img"
      aria-label="Feuille et règle"
      data-ruler={`${Math.round(pose.x * 10) / 10},${Math.round(pose.y * 10) / 10},${pose.angle}`}
      {...data}
      onPointerDown={(event) => {
        if (locked) return;
        event.preventDefault();
        const target = event.target as Element;
        const point = toSheet(svg.current!, event);
        let mode: 'move' | 'turn' | 'paper' = 'paper';
        if (target.closest('.knob')) mode = 'turn';
        else if (target.closest('.ruler')) mode = 'move';
        else if (!onPaper) return;
        const { x, y } = latest.current;
        drag.current = { mode, offset: { x: point.x - x, y: point.y - y } };
        svg.current!.setPointerCapture(event.pointerId);
        follow(point, true);
      }}
      onPointerMove={(event) => {
        if (locked || !svg.current!.hasPointerCapture(event.pointerId)) return;
        follow(toSheet(svg.current!, event), false);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <rect class="paper" width={SHEET.width} height={SHEET.height} rx={2} />
      {lines.map(({ from, to }) => (
        <line
          key={`${from.x},${from.y}`}
          class="segment"
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
        />
      ))}
      {points.map((p) => (
        <circle key={`${p.x},${p.y}`} class="point" cx={p.x} cy={p.y} r={0.9} />
      ))}
      {children}
      <Ruler pose={pose} />
    </svg>
  );
}

/** Ends of the segments, each one once. */
function endsOf(lines: readonly Segment[]): Point[] {
  const ends: Point[] = [];
  for (const { from, to } of lines) {
    for (const p of [from, to]) {
      if (!ends.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.01)) ends.push(p);
    }
  }
  return ends;
}

/** Measuring with the ruler, the length typed on the keypad in two rows under the sheet. */
export function RulerMeasure({
  exercise,
  input,
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<Extract<ExerciseInput, { kind: 'ruler' }>>) {
  const [sent, setSent] = useState<string | null>(null);
  const start = { ...input.ruler, angle: 0 };
  const pose = useRef<Pose>(start);
  const { entry, press } = useEntry(3, locked, (value) => {
    setSent(value);
    onSubmit(value, { ruler: pose.current });
  });
  const tried = !right && shown === null && entry === sent;
  return (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
        <Sheet
          class="measure"
          lines={input.lines}
          points={endsOf(input.lines)}
          start={start}
          locked={locked}
          onPose={(next) => (pose.current = next)}
        />
      </Work>
      <AnswerZone>
        <div class="measured">
          <Answer entry={entry} right={right} shown={shown} tried={tried} />
          <span class="unit">{input.unit}</span>
        </div>
        <Keypad rows ready={entry !== ''} locked={locked} press={press} />
      </AnswerZone>
    </>
  );
}

/** A pencil stroke from the point: a thin band, which has a height to be seen and touched. */
function Stroke({ start, length, state }: { start: Point; length: number; state: string }) {
  return (
    <rect
      class={`drawn ${state}`}
      x={start.x}
      y={start.y - 0.4}
      width={length}
      height={0.8}
      rx={0.4}
    />
  );
}

/**
 * Drawing a segment from the point (#57): the finger draws it along the sheet from the point,
 * to the millimetre; the ruler helps to stop at the right graduation. Keyboard: arrows, Enter.
 */
export function RulerDraw({
  exercise,
  input,
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<Extract<ExerciseInput, { kind: 'draw' }>>) {
  const { start } = input;
  const [length, setLength] = useState(0);
  const [sent, setSent] = useState<number | null>(null);
  const latest = useRef(0);
  const set = (value: number) => {
    latest.current = Math.min(RULER_MM, Math.max(0, Math.round(value)));
    setLength(latest.current);
  };
  const submit = () => {
    if (locked || latest.current === 0) return;
    setSent(latest.current);
    onSubmit(String(latest.current));
  };
  const keys = useRef({ locked, submit });
  keys.current = { locked, submit };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keys.current.locked) return;
      const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (move !== undefined) set(latest.current + move);
      else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shownLength = shown === null ? null : Number(shown);
  let state = 'placed';
  if (right) state = 'right';
  else if (sent === length) state = 'tried';
  return (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
        <Sheet
          class="draw"
          lines={[]}
          points={[start]}
          start={{ ...input.ruler, angle: 0 }}
          locked={locked}
          data={{ 'data-length': String(length) }}
          onPaper={(point) => set(point.x - start.x)}
        >
          {length > 0 && <Stroke start={start} length={length} state={state} />}
          {shownLength !== null && <Stroke start={start} length={shownLength} state="shown" />}
        </Sheet>
      </Work>
      <AnswerZone>
        <button
          type="button"
          class="submit"
          disabled={locked || length === 0}
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
