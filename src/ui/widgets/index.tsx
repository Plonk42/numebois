import type { ComponentType } from 'preact';
import type { Exercise, ExerciseInput, Figure } from '../../core/types';
import { AnswerZone, Statement, Work, Written } from '../slate';
import { Choice } from './choice';
import { CompareSigns } from './compare';
import { Answer, Keypad, useEntry } from './keypad';
import { NumberLineFigure, NumberLinePlace } from './number-line';
import { BlocksFigure, PlaceValueFigure } from './place-value';

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
  onSubmit(answer: string): void;
}

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
};

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
}: WidgetProps<Extract<ExerciseInput, { kind: 'keypad' }>>) {
  const { entry, press } = useEntry(input.maxDigits, locked, onSubmit);
  const inline = input.inline ? { maxDigits: input.maxDigits } : undefined;
  const answer = <Answer entry={entry} right={right} shown={shown} inline={inline} />;
  return (
    <>
      {inline ? (
        <Work wide>
          <Written text={exercise.statement} digits={inline.maxDigits}>
            {answer}
          </Written>
        </Work>
      ) : (
        <Subject exercise={exercise} />
      )}
      <AnswerZone>
        {!inline && answer}
        <Keypad entry={entry} locked={locked} press={press} />
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
};

/** The widget of the exercise's input. */
export function Widget(props: WidgetProps) {
  const Component = WIDGETS[props.input.kind] as ComponentType<WidgetProps>;
  return <Component {...props} />;
}
