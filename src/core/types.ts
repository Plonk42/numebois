import type { Rng } from './rng';

/** `<domain>.<notion>`, stable: saves refer to it, never rename a published one. */
export type SkillId = string;

/** How the child answers; the shared widget of the same name collects the answer. */
export type ExerciseInput =
  { kind: 'keypad'; maxDigits: number } | { kind: 'choice'; options: readonly string[] };

export interface Exercise {
  skill: SkillId;
  level: number;
  /** Short instruction, for example « Écris ce nombre en chiffres. » */
  instruction: string;
  /** What the child works on, displayed large. */
  statement: string;
  input: ExerciseInput;
  /** Expected answer, as the widget returns it. */
  answer: string;
}

/** A notion: pure functions only, the random generator is injected. */
export interface Skill<E extends Exercise = Exercise> {
  id: SkillId;
  /** Displayed name, in French. */
  name: string;
  prerequisites: readonly SkillId[];
  /** Number of internal difficulty levels, from 0 to `levels - 1`. */
  levels: number;
  generate(rng: Rng, level: number): E;
  validate(exercise: E, answer: string): boolean;
  /** 1: a method hint; 2: the answer with its method. */
  hint(exercise: E, attempt: 1 | 2): string;
}

export interface Domain {
  id: string;
  /** Displayed name, in French. */
  name: string;
  skills: readonly Skill[];
}
