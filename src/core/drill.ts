import { isAutomated, isSure, type FactProgress } from './facts';
import type { Rng } from './rng';
import type { Achievement, Session } from './session';
import type { Exercise, FactId, Skill, SkillId } from './types';

/**
 * What a drill works on: a notion (« Je choisis », « Recommandé »), maybe one group of its
 * facts (« la table de 7 »), or the facts least automated (« Mes faits fragiles »).
 */
export type DrillTarget = { kind: 'skill'; skill: SkillId; group?: string } | { kind: 'fragile' };

/** A missed question comes back this many questions later, at random. */
export const COMEBACK = [2, 3] as const;
/** Rate of right first answers the mix of hard and sure questions aims at. */
export const DRILL_RATE = 0.8;
/** Answers of the drill the rate is measured on. */
const RECENT = 10;
/** Hard questions in a row at most, before a sure one. */
export const HARD_RUN = 2;
/** Facts worked on at once in « Mes faits fragiles ». */
export const FRAGILE_FACTS = 6;
/** Draws to avoid asking the same question twice in a row. */
const REDRAWS = 20;

/** A kind of question: a fact, or an easy or current level of a notion without facts. */
interface Item {
  skill: Skill;
  fact: FactId | null;
  easy: boolean;
}

interface Question {
  skill: Skill;
  exercise: Exercise;
}

/**
 * Calculations one after the other until they are automatic, without a budget: hard
 * questions mixed with sure ones to keep about 80 % right, a missed one coming back 2 or 3
 * questions later. The answers go to the progress of the session (mastery, review, facts).
 */
export class Drill {
  /** Right first answers, in order. */
  readonly results: boolean[] = [];
  /** Questions asked so far. */
  asked = 0;
  private readonly missed: (Question & { at: number })[] = [];
  private hardRun = 0;
  private previous: Exercise | null = null;

  constructor(
    private readonly session: Session,
    readonly target: DrillTarget,
    private readonly rng: Rng,
  ) {}

  ask(): Question {
    const index = this.asked++;
    const due = this.missed.findIndex((question) => question.at <= index);
    if (due >= 0) {
      const [{ skill, exercise }] = this.missed.splice(due, 1);
      this.hardRun++;
      return this.posed({ skill, exercise });
    }
    const { hard, sure } = this.items();
    // Sure questions while a missed one waits to come back.
    const wantSure =
      sure.length > 0 &&
      (hard.length === 0 ||
        this.missed.length > 0 ||
        this.hardRun >= HARD_RUN ||
        this.rate() < DRILL_RATE);
    this.hardRun = wantSure ? 0 : this.hardRun + 1;
    const pool = wantSure ? sure : hard;
    let question = this.pose(this.rng.pick(pool));
    for (let i = 0; i < REDRAWS && this.same(question.exercise); i++) {
      question = this.pose(this.rng.pick(pool));
    }
    return this.posed(question);
  }

  /** The question is over: `right` at the only try, `ms` measured in silence. */
  conclude(skill: Skill, exercise: Exercise, right: boolean, ms: number): Achievement[] {
    this.results.push(right);
    if (!right) {
      const at = this.asked - 1 + this.rng.pick(COMEBACK);
      this.missed.push({ skill, exercise, at });
    }
    return this.session.learn(skill, exercise, right, ms);
  }

  /** Right first answers over the last ones, 0 before the first. */
  private rate(): number {
    const recent = this.results.slice(-RECENT);
    return recent.length === 0 ? 0 : recent.filter(Boolean).length / recent.length;
  }

  private same(exercise: Exercise): boolean {
    return (
      exercise.statement === this.previous?.statement && exercise.answer === this.previous.answer
    );
  }

  private posed(question: Question): Question {
    this.previous = question.exercise;
    return question;
  }

  private pose({ skill, fact, easy }: Item): Question {
    if (fact) return { skill, exercise: skill.facts!.exercise(fact, this.rng) };
    const level = this.session.progress.get(skill.id)?.level ?? 0;
    const asked = easy ? level - 1 : level;
    return { skill, exercise: skill.generate(this.rng, asked, this.session.context()) };
  }

  private items(): { hard: Item[]; sure: Item[] } {
    const { facts } = this.session;
    if (this.target.kind === 'fragile') {
      const skills = this.session.skills.filter((skill) => skill.facts);
      const hard = fragileFacts(skills, facts).slice(0, FRAGILE_FACTS);
      const sure = skills.flatMap((skill) =>
        skill.facts!.all.filter((fact) => isSure(facts.get(fact))).map((fact) => ({ skill, fact })),
      );
      return { hard: hard.map(asItem), sure: sure.map(asItem) };
    }
    const { skill: id, group } = this.target;
    const skill = this.session.skills.find((candidate) => candidate.id === id);
    if (!skill) throw new Error(`notion inconnue : ${id}`);
    if (!skill.facts) {
      const level = this.session.progress.get(skill.id)?.level ?? 0;
      return {
        hard: [{ skill, fact: null, easy: false }],
        sure: level > 0 ? [{ skill, fact: null, easy: true }] : [],
      };
    }
    const all = group
      ? skill.facts.groups?.find((candidate) => candidate.id === group)?.facts
      : skill.facts.all;
    if (!all) throw new Error(`groupe inconnu : ${id} ${group}`);
    const items = all.map((fact) => asItem({ skill, fact }));
    return {
      hard: items.filter((item) => !isSure(facts.get(item.fact!))),
      sure: items.filter((item) => isSure(facts.get(item.fact!))),
    };
  }
}

function asItem({ skill, fact }: { skill: Skill; fact: FactId }): Item {
  return { skill, fact, easy: false };
}

/**
 * The facts already met and not automated, least automated first: fewest fast days, then
 * the lowest rate of right answers. Empty: « Mes faits fragiles » has nothing to offer.
 */
export function fragileFacts(
  skills: readonly Skill[],
  facts: ReadonlyMap<FactId, FactProgress>,
): { skill: Skill; fact: FactId }[] {
  const met = skills.flatMap((skill) =>
    (skill.facts?.all ?? []).flatMap((fact) => {
      const progress = facts.get(fact);
      return progress && progress.tries > 0 && !isAutomated(progress)
        ? [{ skill, fact, progress }]
        : [];
    }),
  );
  const rate = (p: FactProgress) => p.right / p.tries;
  met.sort(
    (a, b) =>
      a.progress.fastDays.length - b.progress.fastDays.length ||
      rate(a.progress) - rate(b.progress),
  );
  return met.map(({ skill, fact }) => ({ skill, fact }));
}
