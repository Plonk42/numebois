import type { Rng } from './rng';
import type { Point, Segment } from './sheet';

/** `<domain>.<notion>`, stable: saves refer to it, never rename a published one. */
export type SkillId = string;

/** A graduated line: a tick every `step` from `from` to `to`, numbers written under `labels`. */
export interface NumberLine {
  from: number;
  to: number;
  step: number;
  labels: readonly number[];
}

/** One column of an operation set out on a sheet, from the units: what is written in it. */
export interface Column {
  /** Written under the line. */
  digit: number;
  /** Written over the next column (0: none). */
  carry: number;
  /** Its calculation, with the carry it receives: « 1 + 4 + 7 = 12 ». */
  calc: string;
  /** What Plume says while guiding: « J’écris 2, je retiens 1. » */
  say: string;
}

/**
 * How much the column operation helps: Plume tells each column (`guided`), each
column is
 * checked as it is written (`accompanied`), or the whole result at the end (`alone`).
 */
export type ColumnMode = 'guided' | 'accompanied' | 'alone';

/**
 * How the child sets the numbers out before working the operation out (#158): a touch on the
 * box where a number starts (`tap`), or each digit written in its box, then checked (`write`).
 */
export type ColumnSetup = 'tap' | 'write';

/** How the child answers; the shared widget of the same name collects the answer. */
export type ExerciseInput =
  | {
      kind: 'keypad';
      maxDigits: number;
      /** Written in the operation, as on a sheet: in place of its `?`, or after an added `=`. */
      inline?: boolean;
    }
  | { kind: 'choice'; options: readonly string[] }
  /** `<`, `=` or `>` set between two numbers, changed at will, then confirmed. */
  | { kind: 'compare'; left: string; right: string }
  /** A number placed with the finger on a tick of the line. */
  | { kind: 'number-line'; line: NumberLine }
  /**
   * An operation set out in columns, its result written digit by digit from the units, each
   * carry over the next column (or in the bag, for a multiplication); the answer is the result.
   */
  | {
      kind: 'column';
      /** A multiplication's carry waits in the bag beside it (« sac à retenue »). */
      operator: '+' | '×';
      rows: readonly number[];
      /** From the units, as many as the digits of the result. */
      columns: readonly Column[];
      mode: ColumnMode;
      /** Absent: already set out (a demo of Plume). */
      setup?: ColumnSetup;
    }
  /** A time written in its boxes, hours then minutes (then seconds): « 14h10 » (`timeText`). */
  | {
      kind: 'time';
      seconds: boolean;
      /** A duration: « min » after the minutes box, « 1h20 » read as 1 h 20 min. */
      duration?: boolean;
    }
  /** The hands of a clock set with the finger, the minute hand by `step` minutes: « 3h45 ». */
  | { kind: 'clock'; step: 1 | 5 }
  /**
   * Segments on a sheet, measured with a ruler the child moves and turns; the total length is
   * typed, in `unit`. The ruler starts at rest at `ruler` (its 0), not on a segment.
   */
  | { kind: 'ruler'; lines: readonly Segment[]; unit: 'cm' | 'mm'; ruler: Point }
  /** A segment drawn from `start`, along the ruler: its length in millimetres. */
  | { kind: 'draw'; start: Point; ruler: Point };

/** What the child looks at without touching it, under the statement (one component per kind). */
export type Figure =
  | { kind: 'number-line'; line: NumberLine; arrow: number }
  /** Base-ten blocks: plates of 100, bars of 10 and cubes of 1. */
  | { kind: 'blocks'; hundreds: number; tens: number; units: number }
  /** A place-value table, one column per rank down to the units, a digit in each. */
  | { kind: 'place-value'; digits: readonly number[] }
  /** `rows × columns` as a grid of dots: `rows` rows of `columns` dots. */
  | { kind: 'dots'; rows: number; columns: number }
  /** A clock to read, `hours` from 0 to 23; the second hand when `seconds` is given. */
  | { kind: 'clock'; hours: number; minutes: number; seconds?: number }
  /**
   * A timeline of the day (frise), `start` and `end` in minutes since midnight, a jump drawn to
   * each whole hour between them; when the end is `asked`, a single jump with its duration.
   */
  | { kind: 'timeline'; start: number; end: number; asked: 'duration' | 'end' }
  /** A month of the calendar, `month` from 0 (January), the weeks from Monday; `mark` circles a day. */
  | { kind: 'calendar'; year: number; month: number; mark?: number }
  /**
   * An instrument to read (#58): the dial of a kitchen scale or a measuring jug, a tick every
   * `step` and a number every `label` up to `max`, the needle or the liquid on `value`.
   */
  | {
      kind: 'gauge';
      instrument: 'scale' | 'jug';
      max: number;
      step: number;
      label: number;
      value: number;
      unit: string;
    };

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
  /** Can be timed in a challenge (défi). */
  challenge?: boolean;
  /** Elementary facts known by heart, followed one by one: the notion is played in drills. */
  facts?: SkillFacts<E>;
}

/** `<skill>:<key>`, for example `times-tables.facts:7x8`; stable like the notions. */
export type FactId = string;

export interface SkillFacts<E extends Exercise = Exercise> {
  all: readonly FactId[];
  /** The fact an exercise works on, or null when it is not an elementary fact. */
  of(exercise: E): FactId | null;
  /** An exercise on this declared fact, for the drill. */
  exercise(fact: FactId, rng: Rng): E;
  /** A right first answer under this time counts towards automation. */
  seconds: number;
  /** Sets of facts a drill can be limited to (« la table de 7 »). */
  groups?: readonly FactGroup[];
}

export interface FactGroup {
  /** Stable: the parent's recommended drill refers to it. */
  id: string;
  /** Displayed name, in French: « La table de 7 ». */
  name: string;
  facts: readonly FactId[];
}

/** One step of a lesson (« Plume te montre une astuce »), played by `LessonPlayer`. */
export type LessonStep =
  /** Plume explains, a figure to look at, or an exercise the widget plays by itself (`demo`). */
  | { kind: 'explain'; text: string; figure?: Figure; demo?: Exercise }
  /** The child tries on a widget: a slip costs nothing, Plume's text stays. */
  | { kind: 'manipulate'; text: string; exercise: Exercise }
  /** An example worked out with Plume: the widget guides when it can (a guided column). */
  | { kind: 'guidedExample'; text: string; exercise: Exercise }
  /** 2 or 3 exercises of the notion at `level`, without effect on mastery. */
  | { kind: 'check'; count: 2 | 3; level: number };

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
