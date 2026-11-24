import { apply, type ProblemExercise } from './problems';

/** 1: how to start; 2: the calculation, step by step. */
export function problemHint({ steps, method }: ProblemExercise, attempt: 1 | 2): string {
  if (attempt === 1) return method;
  const lines = steps.map((step) => `${step[0]} ${step[1]} ${step[2]} = ${apply(step)}`);
  return `${lines.join(', puis ')}.`;
}
