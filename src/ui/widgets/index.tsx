import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Exercise, ExerciseInput, Figure, WidgetState } from '../../core/types';
import { AnswerZone, Statement, Work, Written } from '../slate';
import { Choice } from './choice';
import { ClockFigure, ClockSet } from './clock';
import { ColumnOperation } from './column-operation';
import { CompareSigns } from './compare';
import { Answer, Keypad, useEntry } from './keypad';
import { NumberLineFigure, NumberLinePlace } from './number-line';
import { BlocksFigure, DotsFigure, PlaceValueFigure } from './place-value';
import { TimeEntry } from './time-entry';
import { CalendarFigure, TimelineFigure } from './day';
import { RulerDraw, RulerMeasure } from './ruler';
import { Jug, ScaleDial } from './gauge';
import { ConversionTable, Purse } from './units';
import { FractionEntry, FractionFigure, PartsColour } from './fraction';

/** What every widget receives; the validation and the hints come from the domain. */
export interface WidgetProps<I extends ExerciseInput = ExerciseInput> {
  exercise: Exercise;
  input: I;
  /** The answer is checked or shown: the widget waits. */
  locked: boolean;
  /** The last answer is right: shown in green. */
  right: boolean;
  /** The expected answer, shown after the second mistake. */
  shown: string | null;
  onSubmit(answer: string, state?: WidgetState): void;
  /** A slip caught inside the widget (a column checked as it is written): not a first try. */
  onSlip?(): void;
  /** Plays the expected answer by itself, then submits it (an astuce of Plume, #50). */
  demo?: boolean;
}

/** Widgets that play their answer by themselves; the others show it at once (`shown`). */
export const PLAYS_ITSELF: ReadonlySet<ExerciseInput['kind']> = new Set(['keypad', 'column']);
/** A demo types one key at a time. */
const DEMO_KEY_MS = 700;

type Widgets = {
  [K in ExerciseInput['kind']]: ComponentType<WidgetProps<Extract<ExerciseInput, { kind: K }>>>;
};

type Figures = {
  [K in Figure['kind']]: ComponentType<{ figure: Extract<Figure, { kind: K }> }>;
};

/** One component per kind of figure (a new kind does not compile without it). */
const FIGURES: Figures = {
  'number-line': ({ figure }) => <NumberLineFigure line={figure.line} arrow={figure.arrow} />,
  blocks: ({ figure: { hundreds, tens, units } }) => (
    <BlocksFigure hundreds={hundreds} tens={tens} units={units} />
  ),
  'place-value': ({ figure }) => <PlaceValueFigure digits={figure.digits} />,
  dots: ({ figure }) => <DotsFigure rows={figure.rows} columns={figure.columns} />,
  clock: ({ figure: { hours, minutes, seconds } }) => (
    <ClockFigure hours={hours} minutes={minutes} seconds={seconds} />
  ),
  timeline: ({ figure: { start, end, stops, asked } }) => (
    <TimelineFigure start={start} end={end} stops={stops} asked={asked} />
  ),
  calendar: ({ figure: { year, month, mark } }) => (
    <CalendarFigure year={year} month={month} mark={mark} />
  ),
  gauge: ({ figure: { instrument, ...gauge } }) =>
    instrument === 'scale' ? <ScaleDial {...gauge} /> : <Jug {...gauge} />,
  conversion: ({ figure: { units, digits, marks } }) => (
    <ConversionTable units={units} digits={digits} marks={marks} />
  ),
  money: ({ figure }) => <Purse cents={figure.cents} />,
  fraction: ({ figure }) => <FractionFigure wholes={figure.wholes} />,
};

/** A figure to look at: a number line, base-ten blocks, a place-value table. */
export function FigureView({ figure }: { figure: Figure }) {
  const Drawing = FIGURES[figure.kind] as ComponentType<{ figure: Figure }>;
  return <Drawing figure={figure} />;
}

/** The answer typed one key at a time while `on`, then submitted. */
function useDemo(on: boolean, answer: string, onSubmit: (answer: string) => void): string {
  const [played, setPlayed] = useState('');
  const submit = useRef(onSubmit);
  submit.current = onSubmit;
  useEffect(() => {
    if (!on) return;
    let typed = 0;
    const timer = window.setInterval(() => {
      typed++;
      setPlayed(answer.slice(0, typed));
      if (typed < answer.length) return;
      window.clearInterval(timer);
      submit.current(answer);
    }, DEMO_KEY_MS);
    return () => window.clearInterval(timer);
  }, [on, answer]);
  return played;
}

/** The statement alone on the whole width, or with its figure beside the answer zone. */
function Subject({ exercise }: { exercise: Exercise }) {
  const { figure } = exercise;
  if (!figure) {
    return (
      <Work wide>
        <Statement text={exercise.statement} />
      </Work>
    );
  }
  const Drawing = FIGURES[figure.kind] as ComponentType<{ figure: Figure }>;
  return (
    <Work>
      <Statement text={exercise.statement} />
      <Drawing figure={figure} />
    </Work>
  );
}

/**
 * The keypad, and the number typed above it, or written in the operation as on a sheet.
 */
function Typed({
  exercise,
  input,
  locked,
  right,
  shown,
  onSubmit,
  demo = false,
}: WidgetProps<Extract<ExerciseInput, { kind: 'keypad' }>>) {
  const [sent, setSent] = useState<string | null>(null);
  const { entry, press } = useEntry(input.maxDigits, locked || demo, (value) => {
    setSent(value);
    onSubmit(value);
  });
  const played = useDemo(demo, exercise.answer, onSubmit);
  const tried = !right && shown === null && entry === sent;
  const inline = input.inline ? { maxDigits: input.maxDigits } : undefined;
  const answer = (
    <Answer
      entry={demo ? played : entry}
      right={right}
      shown={shown}
      tried={tried}
      inline={inline}
    />
  );
  return (
    <>
      {inline ? (
        <Work wide={!exercise.figure}>
          <Written text={exercise.statement} digits={inline.maxDigits}>
            {answer}
          </Written>
          {exercise.figure && <FigureView figure={exercise.figure} />}
        </Work>
      ) : (
        <Subject exercise={exercise} />
      )}
      <AnswerZone>
        {!inline && answer}
        <Keypad ready={entry !== ''} locked={locked || demo} press={press} />
      </AnswerZone>
    </>
  );
}

/**
 * One widget per kind of input (a new kind does not compile without its widget). Each one
 * lays itself out on the slate: a `Work` (a clock, an operation…) and an `AnswerZone`, or a
 * `Work wide` that takes the whole width (a statement alone, a ruler…).
 */
const WIDGETS: Widgets = {
  keypad: Typed,
  choice: ({ exercise, input, ...state }) => (
    <>
      <Subject exercise={exercise} />
      <AnswerZone>
        <Choice options={input.options} {...state} />
      </AnswerZone>
    </>
  ),
  compare: CompareSigns,
  'number-line': NumberLinePlace,
  column: ColumnOperation,
  time: ({ exercise, ...props }) => (
    <>
      <Subject exercise={exercise} />
      <AnswerZone>
        <TimeEntry exercise={exercise} {...props} />
      </AnswerZone>
    </>
  ),
  clock: ClockSet,
  ruler: RulerMeasure,
  draw: RulerDraw,
  fraction: ({ exercise, locked, right, shown, onSubmit }) => (
    <>
      <Subject exercise={exercise} />
      <AnswerZone>
        <FractionEntry locked={locked} right={right} shown={shown} onSubmit={onSubmit} />
      </AnswerZone>
    </>
  ),
  parts: PartsColour,
};

/** The widget of the exercise's input. */
export function Widget(props: WidgetProps) {
  const Component = WIDGETS[props.input.kind] as ComponentType<WidgetProps>;
  return <Component {...props} />;
}
