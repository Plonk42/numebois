import type { ComponentType } from 'preact';
import type { Exercise, ExerciseInput } from '../../core/types';
import { AnswerZone, Statement, Work } from '../slate';
import { Choice } from './choice';
import { Keypad } from './keypad';

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

/**
 * One widget per kind of input (a new kind does not compile without its widget). Each one
 * lays itself out on the slate: a `Work` (a clock, an operation…) and an `AnswerZone`, or a
 * `Work wide` that takes the whole width (a statement alone, a ruler…).
 */
const WIDGETS: Widgets = {
  keypad: ({ exercise, input, ...state }) => (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
      </Work>
      <AnswerZone>
        <Keypad maxDigits={input.maxDigits} {...state} />
      </AnswerZone>
    </>
  ),
  choice: ({ exercise, input, ...state }) => (
    <>
      <Work wide>
        <Statement text={exercise.statement} />
      </Work>
      <AnswerZone>
        <Choice options={input.options} {...state} />
      </AnswerZone>
    </>
  ),
};

/** The widget of the exercise's input. */
export function Widget(props: WidgetProps) {
  const Component = WIDGETS[props.input.kind] as ComponentType<WidgetProps>;
  return <Component {...props} />;
}
