import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { apply, type Operator, type ProblemExercise, type Step } from './problems';

const text = ([a, op, b]: Step) => `${a} ${op} ${b}`;
const VERBS: Record<Operator, string> = { '+': 'ajouter', '−': 'enlever', '×': 'multiplier par' };

/** The operation a child takes instead: a sum for a difference or a product, else the difference. */
function otherOperation([a, op, b]: Step): Step {
  return op === '+' ? [Math.max(a, b), '−', Math.min(a, b)] : [a, '+', b];
}

/** Two steps: only the first one done, or the second one the other way. */
function stepsSlip(steps: readonly Step[], answer: number): string | null {
  const [first, then, c] = steps[1];
  if (answer === first)
    return `Tu as fait la 1re étape : ${first}.\nIl reste à ${VERBS[then]} ${c}.`;
  if (then === '×' || answer !== apply([first, then === '+' ? '−' : '+', c])) return null;
  return 'La 1re étape est bonne.\nRelis la fin : on ajoute ou on enlève ?';
}

/**
 * What a wrong answer tells (#168): the other operation, only the first step, the second step
 * the other way, or the right calculation a little off.
 */
function problemSlip({ steps, method }: ProblemExercise, answer: number): string | null {
  const last = steps.at(-1)!;
  if (steps.length === 1) {
    const other = otherOperation(last);
    if (answer === apply(other)) return `Ça, c’est ${text(other)}.\n${method}`;
  } else {
    const slip = stepsSlip(steps, answer);
    if (slip) return slip;
  }
  const off = Math.abs(answer - apply(last));
  if (off !== 1 && off !== 10) return null;
  return `Tu as choisi le bon calcul.\nRefais ${text(last)} : tu es à ${off} près.`;
}

/** 1: the mistake when recognised, else how to start; 2: the calculation, step by step. */
export function problemHint(exercise: ProblemExercise, attempt: 1 | 2, tried?: Tried): string {
  const { steps, method } = exercise;
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const slip =
      answer === null || String(answer) === exercise.answer ? null : problemSlip(exercise, answer);
    return slip ?? method;
  }
  const lines = steps.map((step) => `${step[0]} ${step[1]} ${step[2]} = ${apply(step)}`);
  return `${lines.join(', puis ')}.`;
}
