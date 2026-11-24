import type { Rng } from './rng';

/** `<domain>.<notion>`, stable: saves refer to it, never rename a published one. */
export type SkillId = string;

/** A graduated line: a tick every `step` from `from` to `to`, numbers written under `labels`. */
export interface NumberLine {
  from: number;
  to: number;
  step: number;
  labels: readonly number[];
}

/** How the child answers; the shared widget of the same name collects the answer. */
export type ExerciseInput =
  | { kind: 'keypad'; maxDigits: number }
  | { kind: 'choice'; options: readonly string[] }
  /** `<`, `=` or `>` set between two numbers, changed at will, then confirmed. */
  | { kind: 'compare'; left: string; right: string }
  /** A number placed with the finger on a tick of the line. */
  | { kind: 'number-line'; line: NumberLine };

/** What the child looks at without touching it, under the statement (one component per kind). */
export type Figure =
  | { kind: 'number-line'; line: NumberLine; arrow: number }
  /** Base-ten blocks: plates of 100, bars of 10 and cubes of 1. */
  | { kind: 'blocks'; hundreds: number; tens: number; units: number }
  /** A place-value table, one column per rank down to the units, a digit in each. */
  | { kind: 'place-value'; digits: readonly number[] };

export interface Exercise {
  skill: SkillId;
  level: number;
  /** Short instruction, for example « Écris ce nombre en chiffres. » */
  instruction: string;
  /** What the child works on, displayed large. */
  statement: string;
  figure?: Figure;
  input: ExerciseInput;
  /** Expected answer, as the widget returns it. */
  answer: string;
}

/** A noun of the statements, in the singular and the plural. */
export interface Noun {
  one: string;
  many: string;
}

/** Someone of a decor: `name` as written inside a sentence, `to` after « donner ». */
export interface Character {
  name: string;
  to: string;
  pronoun: 'il' | 'elle';
}

/** The words of a decor, so word problems tell of the painting in progress. */
export interface Vocabulary {
  /** Who gathers, has and gives things. */
  gatherers: readonly Character[];
  /** Who receives them. */
  friends: readonly Character[];
  /** Things to count, picked up one by one. */
  items: readonly Noun[];
  /** Where they are, after the verb: « près du ruisseau ». */
  places: readonly string[];
  /** Things packed by groups: « 6 paniers de 8 champignons ». */
  groups: readonly { group: Noun; item: Noun }[];
}

/** What a generator knows of the game: the words of the decor of the painting. */
export interface ExerciseContext {
  vocabulary: Vocabulary;
}

/** A notion: pure functions only, the random generator is injected. */
export interface Skill<E extends Exercise = Exercise> {
  id: SkillId;
  /** Displayed name, in French. */
  name: string;
  prerequisites: readonly SkillId[];
  /** Number of internal difficulty levels, from 0 to `levels - 1`. */
  levels: number;
  generate(rng: Rng, level: number, context: ExerciseContext): E;
  validate(exercise: E, answer: string): boolean;
  /** 1: a method hint; 2: the answer with its method. */
  hint(exercise: E, attempt: 1 | 2): string;
  /**
   * Typical wrong answers of a keypad question (a neighbouring table, a forgotten carry…),
   * when the trail offers it among choices (`offerChoices`).
   */
  lures?(exercise: E): readonly number[];
  /** Can be played in a drill (rafale) until automatic. */
  drill?: boolean;
  /** Can be timed in a challenge (défi). */
  challenge?: boolean;
  /** Elementary facts followed one by one (drill notions only). */
  facts?: SkillFacts<E>;
}

/** `<skill>:<key>`, for example `times-tables.facts:7x8`; stable like the notions. */
export type FactId = string;

export interface SkillFacts<E extends Exercise = Exercise> {
  all: readonly FactId[];
  /** The fact an exercise works on, or null when it is not an elementary fact. */
  of(exercise: E): FactId | null;
  /** A right first answer under this time counts towards automation. */
  seconds: number;
}

/** One step of a lesson (« Plume te montre une astuce »), played by `LessonPlayer`. */
export type LessonStep =
  | { kind: 'explain'; text: string; widget?: string }
  | { kind: 'manipulate'; text: string; widget: string }
  | { kind: 'guidedExample'; text: string; widget: string }
  /** 2 or 3 exercises of the notion, without effect on mastery. */
  | { kind: 'check'; count: 2 | 3 };

export interface Lesson {
  /** `<skill>/<name>`, stable. */
  id: string;
  skill: SkillId;
  /** Displayed title, in French. */
  title: string;
  steps: readonly LessonStep[];
}

export interface Domain {
  id: string;
  /** Displayed name, in French. */
  name: string;
  skills: readonly Skill[];
  lessons?: readonly Lesson[];
}

/** The homework of the week, in `src/quests/YYYY-MM-DD.ts`. */
export interface Quest {
  /** The first day, `YYYY-MM-DD`, also the file name. */
  id: string;
  /** Displayed title, in French. */
  title: string;
  /** Last day, `YYYY-MM-DD`. */
  until: string;
  /** Biome of the next painting, if the quest imposes one. */
  biome?: string;
  skills: readonly { id: SkillId; level?: number; isNew?: boolean }[];
  drill?: SkillId;
  lessons?: readonly string[];
  challenges?: readonly SkillId[];
}
