import type { Exercise, ExerciseInput, Skill } from './types';

/** Content rules for the child (child-ux instructions), checked on every generated exercise. */
export const MAX_SENTENCE_WORDS = 12;
/** Sentences or lines of one of Plume's bubbles: two sentences and a line of calculation. */
export const MAX_BUBBLE_SENTENCES = 3;
/** A bubble this long still leaves room for the longest statement (measured with DejaVu Sans). */
export const MAX_BUBBLE_CHARS = 120;
/** A word problem is read at a glance. */
export const MAX_STATEMENT_WORDS = 25;
/** Choices fit in the answer zone and on the keys 1 to 4. */
export const MAX_CHOICES = 4;

/** Never a word of failure. */
const FAILURE_WORDS =
  /(?<!\p{L})(faux|fausse|erreurs?|rat[ée]e?s?|perdue?s?|échecs?|nulle?)(?!\p{L})/iu;

/** Words of each sentence (lines and . ! ? end a sentence; « · » and « : » are not words). */
export function sentenceLengths(text: string): number[] {
  return text
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word)).length)
    .filter((length) => length > 0);
}

/** Whether an answer has the form its widget returns, for each kind of input. */
const ANSWER_FITS: {
  [K in ExerciseInput['kind']]: (
    input: Extract<ExerciseInput, { kind: K }>,
    answer: string,
  ) => boolean;
} = {
  keypad: (input, answer) => new RegExp(String.raw`^\d{1,${input.maxDigits}}$`).test(answer),
  choice: (input, answer) => input.options.includes(answer),
  compare: (_, answer) => ['<', '=', '>'].includes(answer),
  'number-line': ({ line }, answer) => {
    const value = Number(answer);
    return (
      /^\d+$/.test(answer) &&
      value >= line.from &&
      value <= line.to &&
      (value - line.from) % line.step === 0
    );
  },
};

function inputErrors(input: ExerciseInput, answer: string): string[] {
  const fits = ANSWER_FITS[input.kind] as (input: ExerciseInput, answer: string) => boolean;
  const errors = fits(input, answer) ? [] : [`réponse « ${answer} » hors du widget ${input.kind}`];
  if (input.kind === 'choice') {
    const { options } = input;
    if (new Set(options).size !== options.length) errors.push('choix en double');
    if (options.length < 2 || options.length > MAX_CHOICES) {
      errors.push(`${options.length} choix (2 à ${MAX_CHOICES})`);
    }
  }
  return errors;
}

function textErrors(name: string, text: string, maxSentences: number): string[] {
  const errors: string[] = [];
  const lengths = sentenceLengths(text);
  if (lengths.length === 0) errors.push(`${name} vide`);
  if (Math.max(...lengths) > MAX_SENTENCE_WORDS) {
    errors.push(`${name} : phrase de plus de ${MAX_SENTENCE_WORDS} mots : ${text}`);
  }
  if (lengths.length > maxSentences) errors.push(`${name} : ${lengths.length} phrases : ${text}`);
  if (FAILURE_WORDS.test(text)) errors.push(`${name} : mot d'échec : ${text}`);
  return errors;
}

/**
 * What is wrong with an exercise drawn at `level` (empty when valid): its notion and level,
 * an exact answer that its widget can return, short and kind texts, a declared fact.
 */
export function exerciseErrors(skill: Skill, exercise: Exercise, level: number): string[] {
  const errors: string[] = [];
  if (exercise.skill !== skill.id) errors.push(`notion ${exercise.skill} au lieu de ${skill.id}`);
  if (exercise.level !== level) errors.push(`niveau ${exercise.level} au lieu de ${level}`);
  if (!skill.validate(exercise, exercise.answer)) {
    errors.push(`la réponse attendue « ${exercise.answer} » n'est pas acceptée`);
  }
  errors.push(
    ...inputErrors(exercise.input, exercise.answer),
    ...textErrors('consigne', exercise.instruction, 1),
  );
  const words = sentenceLengths(exercise.statement).reduce((sum, n) => sum + n, 0);
  if (words > MAX_STATEMENT_WORDS) errors.push(`énoncé de ${words} mots : ${exercise.statement}`);
  if (FAILURE_WORDS.test(exercise.statement)) errors.push(`énoncé : mot d'échec`);
  const { input, statement } = exercise;
  if (input.kind === 'keypad' && input.inline && statement.split('?').length > 2) {
    errors.push(`plusieurs « ? » où écrire la réponse : ${statement}`);
  }
  for (const attempt of [1, 2] as const) {
    const hint = skill.hint(exercise, attempt);
    errors.push(...textErrors(`indice ${attempt}`, hint, MAX_BUBBLE_SENTENCES));
    if (hint.length > MAX_BUBBLE_CHARS) {
      errors.push(`indice ${attempt} : ${hint.length} caractères : ${hint}`);
    }
  }
  const fact = skill.facts?.of(exercise);
  if (fact != null && !skill.facts!.all.includes(fact)) errors.push(`fait non déclaré : ${fact}`);
  return errors;
}
