import { useState } from 'preact/hooks';
import { dayLabel } from '../core/day';
import { allAutomated, isFragile } from '../core/facts';
import { isDue, masteryRate } from '../core/mastery';
import { Rng } from '../core/rng';
import type { Play, Session } from '../core/session';
import {
  changeSetting,
  settingOf,
  SKILL_MODES,
  type SkillMode,
  type SkillSetting,
} from '../core/settings';
import type { Lesson, Skill, SkillId } from '../core/types';
import { DOMAINS } from '../domains';
import type { NotebookChoice, Recommended } from '../save/parent';
import type { Requests } from '../core/homework';

const MODE_LABELS: Record<SkillMode, string> = {
  auto: 'Auto',
  closed: 'Fermée',
  open: 'Ouverte',
  focus: 'Focus',
};

/** Days of play shown, the most recent first. */
const DAYS_SHOWN = 7;

const KIND_LABELS: Record<Play['kind'], string> = {
  trail: 'Sentier',
  drill: 'Rafale',
  challenge: 'Défi',
};

const percent = (rate: number) => `${Math.round(rate * 100)} %`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/** The notions of the game grouped by domain, in the order of the registry. */
function byDomain(skills: readonly Skill[]): { name: string; skills: Skill[] }[] {
  const ids = new Set(skills.map((skill) => skill.id));
  return DOMAINS.map((domain) => ({
    name: domain.name,
    skills: domain.skills.filter((skill) => ids.has(skill.id)),
  })).filter((domain) => domain.skills.length > 0);
}

/** The astuces grouped by the domain of their notion, in the order of the registry. */
function lessonsByDomain(lessons: readonly Lesson[]): { name: string; lessons: Lesson[] }[] {
  return DOMAINS.map((domain) => ({
    name: domain.name,
    lessons: lessons.filter((lesson) => domain.skills.some((skill) => skill.id === lesson.skill)),
  })).filter((domain) => domain.lessons.length > 0);
}

/** Where a notion is: à découvrir, en cours, acquis, à revoir, ancré, automatisé. */
function stageLabel(session: Session, skill: Skill, day: number): string {
  const progress = session.progress.get(skill.id);
  if (!progress || progress.stage === 'discovery') return 'À découvrir';
  if (progress.stage === 'learning') return 'En cours';
  if (skill.facts && allAutomated(skill.facts.all, session.facts)) return 'Automatisé';
  if (progress.stage === 'anchored') return 'Ancré';
  return isDue(progress, day) ? 'À revoir' : 'Acquis';
}

/** The plays of the last days with any, the most recent first. */
function playDays(plays: readonly Play[]) {
  const days = new Map<number, { questions: number; right: number; ms: number }>();
  for (const play of plays) {
    const total = days.get(play.day) ?? { questions: 0, right: 0, ms: 0 };
    days.set(play.day, {
      questions: total.questions + play.questions,
      right: total.right + play.right,
      ms: total.ms + play.ms,
    });
  }
  return [...days.entries()]
    .sort(([a], [b]) => b - a)
    .slice(0, DAYS_SHOWN)
    .map(([day, total]) => ({ day, ...total }));
}

/** Questions, time per question and success of each mode over the plays kept (#128). */
function playModes(plays: readonly Play[]) {
  return (Object.keys(KIND_LABELS) as Play['kind'][]).flatMap((kind) => {
    const of = plays.filter((play) => play.kind === kind);
    const questions = of.reduce((sum, play) => sum + play.questions, 0);
    if (questions === 0) return [];
    const right = of.reduce((sum, play) => sum + play.right, 0);
    const ms = of.reduce((sum, play) => sum + play.ms, 0);
    return [{ kind, questions, right, ms }];
  });
}

/** Progress of the child, domain by domain then notion by notion, and the last days of play. */
export function Progress({ session, day }: { session: Session; day: number }) {
  const days = playDays(session.plays);
  const modes = playModes(session.plays);
  const fragile = session.skills.flatMap((skill) =>
    (skill.facts?.all ?? [])
      .filter((fact) => {
        const progress = session.facts.get(fact);
        return progress !== undefined && isFragile(progress);
      })
      .map((fact) => ({ fact, text: skill.facts!.exercise(fact, new Rng(0)).statement })),
  );
  return (
    <div class="tab progress">
      <h3>Dernières séances</h3>
      {days.length === 0 ? (
        <p class="empty">Aucune séance pour l’instant.</p>
      ) : (
        <table class="days">
          <thead>
            <tr>
              <th>Jour</th>
              <th>Temps</th>
              <th>Questions</th>
              <th>Réussite</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{dayLabel(d.day)}</td>
                <td>{Math.max(1, Math.round(d.ms / 60_000))} min</td>
                <td>{d.questions}</td>
                <td>{percent(d.right / d.questions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modes.length > 0 && (
        <>
          <h3>Par mode</h3>
          <table class="per-mode">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Questions</th>
                <th>Par question</th>
                <th>Réussite</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((m) => (
                <tr key={m.kind} data-kind={m.kind}>
                  <td>{KIND_LABELS[m.kind]}</td>
                  <td>{m.questions}</td>
                  <td>{seconds(m.ms / m.questions)}</td>
                  <td>{percent(m.right / m.questions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {byDomain(session.skills).map((domain) => (
        <section key={domain.name}>
          <h3>{domain.name}</h3>
          <table class="skills">
            <tbody>
              {domain.skills.map((skill) => {
                const progress = session.progress.get(skill.id);
                const met = progress !== undefined && progress.recent.length > 0;
                return (
                  <tr key={skill.id} data-skill={skill.id}>
                    <td>{skill.name}</td>
                    <td class="stage">{stageLabel(session, skill, day)}</td>
                    <td>{met ? `Niveau ${progress.level + 1} sur ${skill.levels}` : ''}</td>
                    <td>{met ? percent(masteryRate(progress)) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <h3>Faits fragiles</h3>
      {fragile.length === 0 ? (
        <p class="empty">Aucun fait fragile.</p>
      ) : (
        <p class="fragile">{fragile.map((f) => f.text).join(' · ')}</p>
      )}
    </div>
  );
}

interface SettingsProps {
  session: Session;
  onSettings(settings: Map<SkillId, SkillSetting>): void;
}

/** One notion: how the trail treats it, and the levels asked (shown from 1). */
function SkillRow({
  skill,
  setting,
  onChange,
}: {
  skill: Skill;
  setting: SkillSetting;
  onChange(change: Partial<Omit<SkillSetting, 'skill'>>): void;
}) {
  const top = skill.levels - 1;
  return (
    <tr data-skill={skill.id}>
      <td>{skill.name}</td>
      <td>
        <div class="choices modes" role="group" aria-label={`Réglage : ${skill.name}`}>
          {SKILL_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={setting.mode === mode}
              onPointerDown={() => onChange({ mode })}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </td>
      <td>
        {top > 0 && (
          <div class="levels" role="group" aria-label={`Niveaux : ${skill.name}`}>
            <Stepper
              label="Plus bas"
              value={setting.minLevel}
              top={top}
              onStep={(minLevel) => onChange({ minLevel })}
            />
            <span>à</span>
            <Stepper
              label="Plus haut"
              value={setting.maxLevel}
              top={top}
              onStep={(maxLevel) => onChange({ maxLevel })}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

/** A level, shown from 1, with a button on each side. */
function Stepper({
  label,
  value,
  top,
  onStep,
}: {
  label: string;
  value: number;
  top: number;
  onStep(value: number): void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`${label} : moins`}
        disabled={value === 0}
        onPointerDown={() => onStep(value - 1)}
      >
        −
      </button>
      <span class="level">{value + 1}</span>
      <button
        type="button"
        aria-label={`${label} : plus`}
        disabled={value === top}
        onPointerDown={() => onStep(value + 1)}
      >
        +
      </button>
    </>
  );
}

/**
 * The parent's settings of the notions (#47): auto, closed, open or focus, notion by notion or
 * for a whole domain at once, and the levels asked.
 */
export function Notions({ session, onSettings }: SettingsProps) {
  const [settings, setSettings] = useState(() => new Map(session.settings));
  const change = (skills: readonly Skill[], delta: Partial<Omit<SkillSetting, 'skill'>>) => {
    const next = skills.reduce((all, skill) => changeSetting(all, skill, delta), settings);
    setSettings(next);
    onSettings(next);
  };
  return (
    <div class="tab notions">
      {byDomain(session.skills).map((domain) => (
        <section key={domain.name}>
          <h3>{domain.name}</h3>
          <table class="skills">
            <thead>
              <tr class="domain-row">
                <td>Tout le domaine</td>
                <td>
                  <div
                    class="choices modes"
                    role="group"
                    aria-label={`Tout le domaine : ${domain.name}`}
                  >
                    {SKILL_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={domain.skills.every(
                          (skill) => settingOf(settings, skill).mode === mode,
                        )}
                        onPointerDown={() => change(domain.skills, { mode })}
                      >
                        {MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </td>
                <td />
              </tr>
            </thead>
            <tbody>
              {domain.skills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  setting={settingOf(settings, skill)}
                  onChange={(delta) => change([skill], delta)}
                />
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

/** The drill the stump recommends (#47): none, a notion with facts, or one of its groups. */
function RecommendedDrill({
  skills,
  recommended,
  onRecommended,
}: {
  skills: readonly Skill[];
  recommended: Recommended | null;
  onRecommended(recommended: Recommended | null): void;
}) {
  const drillable = skills.filter((skill) => skill.facts);
  const isRecommended = (skill: SkillId, group?: string) =>
    recommended?.skill === skill && recommended.group === group;
  return (
    <>
      <h3>Rafale recommandée</h3>
      <div class="choices">
        <button
          type="button"
          aria-pressed={recommended === null}
          onPointerDown={() => onRecommended(null)}
        >
          Aucune
        </button>
      </div>
      <table class="skills recommended">
        <tbody>
          {drillable.map((skill) => (
            <tr key={skill.id} data-skill={skill.id}>
              <td>{skill.name}</td>
              <td>
                <div class="choices">
                  <button
                    type="button"
                    aria-pressed={isRecommended(skill.id)}
                    onPointerDown={() => onRecommended({ skill: skill.id })}
                  >
                    Tout
                  </button>
                  {(skill.facts!.groups ?? []).map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={isRecommended(skill.id, group.id)}
                      onPointerDown={() => onRecommended({ skill: skill.id, group: group.id })}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** A day for the parent: « mardi 3 décembre ». */
function dayName(day: number): string {
  const weekday = new Date(day * 86_400_000).toLocaleDateString('fr-FR', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  return `${weekday} ${dayLabel(day)}`;
}

/** A week of homework: the focus lasts until next week's eve. */
const HOMEWORK_DAYS = 6;

interface HomeworkProps extends SettingsProps {
  day: number;
  lessons: readonly Lesson[];
  /** Acquired notions with a challenge: the squirrel can offer one. */
  challenges: readonly Skill[];
  requests: Requests;
  onRequests(requests: Requests): void;
  notebookChoices: readonly NotebookChoice[];
  onNotebookChoices(choices: NotebookChoice[]): void;
  recommended: Recommended | null;
  onRecommended(recommended: Recommended | null): void;
}

/**
 * The homework of the week (#54), set on the tablet in a few touches: one or two notions in
 * focus until a day, an astuce Plume offers and a challenge the squirrel offers at the next
 * trail (always refusable), the astuces of the Carnet, and the recommended drill. The child
 * sees no more than that.
 */
export function Homework(props: HomeworkProps) {
  const { session, day, lessons, challenges, onSettings } = props;
  const [settings, setSettings] = useState(() => new Map(session.settings));
  const [requests, setRequests] = useState(props.requests);
  const [choices, setChoices] = useState(props.notebookChoices);
  const change = (skill: Skill, delta: Partial<Omit<SkillSetting, 'skill'>>) => {
    const next = changeSetting(settings, skill, delta);
    setSettings(next);
    onSettings(next);
  };
  const ask = (asked: Partial<Requests>) => {
    const next = { ...requests, ...asked };
    setRequests(next);
    props.onRequests(next);
  };
  const choose = (lesson: string, shown: boolean | null) => {
    const next = [
      ...choices.filter((c) => c.lesson !== lesson),
      ...(shown === null ? [] : [{ lesson, shown }]),
    ];
    setChoices(next);
    props.onNotebookChoices(next);
  };
  const focus = session.skills.filter((skill) => settingOf(settings, skill).mode === 'focus');
  const others = session.skills.filter(
    (skill) => !['focus', 'closed'].includes(settingOf(settings, skill).mode),
  );
  return (
    <div class="tab homework">
      <h3>Notions en focus</h3>
      {focus.length === 0 && <p class="empty">Aucune notion en focus.</p>}
      <table class="skills focus">
        <tbody>
          {focus.map((skill) => {
            const until = settingOf(settings, skill).until;
            return (
              <tr key={skill.id} data-skill={skill.id}>
                <td>{skill.name}</td>
                <td>
                  <div class="levels" role="group" aria-label={`Jusqu’au : ${skill.name}`}>
                    <button
                      type="button"
                      aria-label="Un jour de moins"
                      disabled={until === undefined || until <= day}
                      onPointerDown={() => change(skill, { until: until! - 1 })}
                    >
                      −
                    </button>
                    <span class="until">
                      {until === undefined ? 'Sans fin' : `Jusqu’au ${dayName(until)}`}
                    </span>
                    <button
                      type="button"
                      aria-label="Un jour de plus"
                      onPointerDown={() => change(skill, { until: (until ?? day - 1) + 1 })}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td>
                  <button type="button" onPointerDown={() => change(skill, { mode: 'auto' })}>
                    Retirer
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <details class="add-focus">
        <summary>Ajouter une notion en focus, pour une semaine</summary>
        {byDomain(others).map((domain) => (
          <section key={domain.name}>
            <h4>{domain.name}</h4>
            <div class="choices">
              {domain.skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onPointerDown={() => change(skill, { mode: 'focus', until: day + HOMEWORK_DAYS })}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </details>

      <h3>Astuce à proposer au prochain sentier</h3>
      <div class="lesson-asked">
        <span>{lessons.find((lesson) => lesson.id === requests.lesson)?.title ?? 'Aucune'}</span>
        {requests.lesson !== null && (
          <button type="button" onPointerDown={() => ask({ lesson: null })}>
            Retirer
          </button>
        )}
      </div>
      <details class="pick-lesson">
        <summary>Choisir une astuce</summary>
        <div role="group" aria-label="Astuce à proposer">
          {lessonsByDomain(lessons).map((domain) => (
            <section key={domain.name}>
              <h4>{domain.name}</h4>
              <div class="choices">
                {domain.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    aria-pressed={requests.lesson === lesson.id}
                    onPointerDown={() => ask({ lesson: lesson.id })}
                  >
                    {lesson.title}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>

      <h3>Défi à proposer après le prochain sentier</h3>
      {challenges.length === 0 ? (
        <p class="empty">Aucune notion acquise n’a encore de défi.</p>
      ) : (
        <div class="choices" role="group" aria-label="Défi à proposer">
          <button
            type="button"
            aria-pressed={requests.challenge === null}
            onPointerDown={() => ask({ challenge: null })}
          >
            Aucun
          </button>
          {challenges.map((skill) => (
            <button
              key={skill.id}
              type="button"
              aria-pressed={requests.challenge === skill.id}
              onPointerDown={() => ask({ challenge: skill.id })}
            >
              {skill.name}
            </button>
          ))}
        </div>
      )}

      <RecommendedDrill
        skills={session.skills}
        recommended={props.recommended}
        onRecommended={props.onRecommended}
      />

      <h3>Astuces dans le Carnet</h3>
      <table class="skills notebook-choices">
        <tbody>
          {lessons.map((lesson) => {
            const shown = choices.find((c) => c.lesson === lesson.id)?.shown ?? null;
            const options: [boolean | null, string][] = [
              [null, 'Une fois vue'],
              [true, 'Toujours'],
              [false, 'Jamais'],
            ];
            return (
              <tr key={lesson.id} data-lesson={lesson.id}>
                <td>{lesson.title}</td>
                <td>
                  <div class="choices" role="group" aria-label={`Carnet : ${lesson.title}`}>
                    {options.map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={shown === value}
                        onPointerDown={() => choose(lesson.id, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
