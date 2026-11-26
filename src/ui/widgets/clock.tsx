import { useEffect, useRef, useState } from 'preact/hooks';
import { onDial, parseTime, timeText } from '../../core/time';
import { AnswerZone, Statement, Work } from '../slate';
import { DIAL_MINUTES, handAngles, turnHourHand, turnMinuteHand, wrap } from './dial';
import type { WidgetProps } from './index';

const SIZE = 400;
const C = SIZE / 2;
const R = 188;
const HOUR_LENGTH = 96;
const MINUTE_LENGTH = 150;
const SECOND_LENGTH = 162;
/** A touch this close to the centre, near the hour hand, takes it; anywhere else, the minute hand. */
const HOUR_REACH = 0.62;
const HOUR_GRAB_DEGREES = 35;

const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

/** A point of the face, `angle` in degrees clockwise from 12. */
function at(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [C + radius * Math.sin(rad), C - radius * Math.cos(rad)];
}

function Hand({ kind, angle, length }: { kind: string; angle: number; length: number }) {
  const tail = kind === 'second' ? 28 : 14;
  return (
    <line
      class={`hand ${kind}`}
      x1={C}
      y1={C + tail}
      x2={C}
      y2={C - length}
      transform={`rotate(${angle} ${C} ${C})`}
    />
  );
}

interface FaceProps {
  hours: number;
  minutes: number;
  seconds?: number;
}

/**
 * A school clock: the numbers of the hours, a tick per minute, the hour hand short and orange,
 * the minute hand long and blue (the colours of the boxes where the time is written), the thin
 * second hand when it counts.
 */
function Face({ hours, minutes, seconds }: FaceProps) {
  const angles = handAngles(hours, minutes, seconds);
  return (
    <>
      <circle class="rim" cx={C} cy={C} r={R} />
      {MINUTES.map((i) => {
        const [x1, y1] = at(i * 6, i % 5 === 0 ? R - 20 : R - 11);
        const [x2, y2] = at(i * 6, R - 3);
        return <line key={i} class={i % 5 === 0 ? 'tick five' : 'tick'} {...{ x1, y1, x2, y2 }} />;
      })}
      {NUMBERS.map((n) => {
        const [x, y] = at(n * 30, R - 48);
        return (
          <text key={n} x={x} y={y}>
            {n}
          </text>
        );
      })}
      <Hand kind="hour" angle={angles.hour} length={HOUR_LENGTH} />
      <Hand kind="minute" angle={angles.minute} length={MINUTE_LENGTH} />
      {seconds !== undefined && <Hand kind="second" angle={angles.second} length={SECOND_LENGTH} />}
      <circle class="pivot" cx={C} cy={C} r={10} />
    </>
  );
}

/** The clock to read, beside the boxes of the time. */
export function ClockFigure(props: FaceProps) {
  return (
    <svg class="clock" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Horloge">
      <Face {...props} />
    </svg>
  );
}

/** Angle and distance (in radii) of a pointer from the centre of the face. */
function polar(svg: SVGSVGElement, event: PointerEvent): { angle: number; reach: number } {
  const box = svg.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * SIZE - C;
  const y = ((event.clientY - box.top) / box.height) * SIZE - C;
  return { angle: wrap((Math.atan2(x, -y) * 180) / Math.PI, 360), reach: Math.hypot(x, y) / R };
}

/**
 * The child sets the hands with the finger (#55): the minute hand turns by `step` minutes and
 * drives the hour hand, as on a real clock; the hour hand, taken near the centre, jumps from
 * hour to hour. The clock starts at 12h00. Keyboard: arrows (minutes, hours), Enter.
 */
export function ClockSet({
  exercise,
  input: { step },
  locked,
  right,
  shown,
  onSubmit,
}: WidgetProps<{ kind: 'clock'; step: 1 | 5 }>) {
  /** Minutes since 12h00 on the dial, from 0 to 719. */
  const [total, setTotal] = useState(0);
  const [sent, setSent] = useState<number | null>(null);
  const latest = useRef(0);
  const grab = useRef<'hour' | 'minute'>('minute');
  const svg = useRef<SVGSVGElement>(null);
  const set = (value: number) => {
    latest.current = wrap(value, DIAL_MINUTES);
    setTotal(latest.current);
  };
  const answerOf = (value: number) => timeText(onDial(Math.floor(value / 60), value % 60));
  const submit = () => {
    if (locked) return;
    setSent(latest.current);
    onSubmit(answerOf(latest.current));
  };
  const turn = (angle: number) => {
    const now = latest.current;
    set(grab.current === 'hour' ? turnHourHand(now, angle) : turnMinuteHand(now, angle, step));
  };
  const keys = useRef({ locked, submit });
  keys.current = { locked, submit };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keys.current.locked) return;
      const move = { ArrowRight: step, ArrowLeft: -step, ArrowUp: 60, ArrowDown: -60 }[event.key];
      if (move !== undefined) set(latest.current + move);
      else if (event.key === 'Enter') keys.current.submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const shownTime = shown === null ? null : parseTime(shown);
  const value = shownTime ? (shownTime.hours % 12) * 60 + shownTime.minutes : total;
  let state = 'placed';
  if (right) state = 'right';
  else if (shownTime) state = 'shown';
  else if (sent === total) state = 'tried';
  return (
    <>
      <Work>
        <Statement text={exercise.statement} />
        <svg
          ref={svg}
          class={`clock set ${state}`}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Horloge à régler"
          data-time={answerOf(value)}
          onPointerDown={(event) => {
            if (locked) return;
            event.preventDefault();
            const { angle, reach } = polar(svg.current!, event);
            const now = latest.current;
            const hourAngle = handAngles(Math.floor(now / 60), now % 60).hour;
            const gap = Math.abs(wrap(angle - hourAngle + 180, 360) - 180);
            grab.current = reach < HOUR_REACH && gap < HOUR_GRAB_DEGREES ? 'hour' : 'minute';
            svg.current!.setPointerCapture(event.pointerId);
            turn(angle);
          }}
          onPointerMove={(event) => {
            if (locked || !svg.current!.hasPointerCapture(event.pointerId)) return;
            turn(polar(svg.current!, event).angle);
          }}
        >
          <Face hours={Math.floor(value / 60)} minutes={value % 60} />
        </svg>
      </Work>
      <AnswerZone>
        <button
          type="button"
          class="submit"
          disabled={locked}
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
