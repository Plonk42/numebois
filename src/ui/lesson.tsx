import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Rng } from '../core/rng';
import type {
  Exercise,
  ExerciseContext,
  Figure,
  Lesson,
  Skill,
  Tried,
  WidgetState,
} from '../core/types';
import { Plume, type Mood } from './character';
import { AnswerZone, Slate, Statement, Work, type SlateHint } from './slate';
import { FigureView, PLAYS_ITSELF, Widget } from './widgets';

/** A step as played: something to read, an exercise played by itself, or one to try. */
type Unit =
  | { kind: 'explain'; text: string; figure?: Figure }
  | { kind: 'demo'; text: string; exercise: Exercise }
  | { kind: 'try'; text?: string; exercise: Exercise };

/** The steps of a lesson, each check drawn into its exercises of the notion. */
function unitsOf(
  lesson: Lesson,
  skills: ReadonlyMap<string, Skill>,
  rng: Rng,
  context: ExerciseContext,
): Unit[] {
  return lesson.steps.flatMap((step): Unit[] => {
    switch (step.kind) {
      case 'explain':
        return step.demo
          ? [{ kind: 'demo', text: step.text, exercise: step.demo }]
          : [{ kind: 'explain', text: step.text, figure: step.figure }];
      case 'manipulate':
      case 'guidedExample':
        return [{ kind: 'try', text: step.text, exercise: step.exercise }];
      case 'check': {
        const skill = skills.get(lesson.skill)!;
        return Array.from({ length: step.count }, () => ({
          kind: 'try',
          exercise: skill.generate(rng, step.level, context),
        }));
      }
    }
  });
}

/** Whether every notion of a lesson is known: its own, and those of its exercises. */
export function lessonPlayable(lesson: Lesson, skills: ReadonlyMap<string, Skill>): boolean {
  return (
    skills.has(lesson.skill) &&
    lesson.steps.every((step) => {
      if (step.kind === 'check') return true;
      const exercise = step.kind === 'explain' ? step.demo : step.exercise;
      return !exercise || skills.has(exercise.skill);
    })
  );
}

/** A widget that talks by itself in Plume's bubble while it guides (a column operation). */
const coaches = (exercise: Exercise, demo: boolean) =>
  exercise.input.kind === 'column' && (demo || exercise.input.mode !== 'alone');

type Phase = 'asking' | 'right' | 'reveal';

/** A widget without a demo of its own shows its answer after this long. */
const SHOWN_DEMO_MS = 1500;

/** The step on the slate, for the tests: what it is and its exercise. */
export interface LessonShown {
  id: string;
  step: number;
  kind: Unit['kind'];
  exercise: Exercise | null;
}

interface LessonProps {
  lesson: Lesson;
  skills: ReadonlyMap<string, Skill>;
  rng: Rng;
  context: ExerciseContext;
  onShow?(shown: LessonShown): void;
  onDone(): void;
  /** Opened from the Carnet: the child may close it before its end (#203). */
  onClose?(): void;
}

/**
 * « Plume te montre une astuce » (#50): its steps one after the other on the slate. Plume
 * explains, a widget plays an answer by itself, the child tries with her, then a few exercises
 * of the notion. Nothing counts for the mastery nor brings leaves: a mistake shows the hint,
 * a second one the answer, as on the trail.
 */
export function LessonPlayer({
  lesson,
  skills,
  rng,
  context,
  onShow,
  onDone,
  onClose,
}: LessonProps) {
  const units = useMemo(() => unitsOf(lesson, skills, rng, context), [lesson]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [mistakes, setMistakes] = useState(0);
  const [tried, setTried] = useState<Tried | undefined>(undefined);
  const unit = units[index];
  useEffect(() => {
    onShow?.({
      id: lesson.id,
      step: index,
      kind: unit.kind,
      exercise: unit.kind === 'explain' ? null : unit.exercise,
    });
  }, [lesson, index]);

  const next = () => {
    if (index + 1 === units.length) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setPhase('asking');
    setMistakes(0);
    setTried(undefined);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // A widget without a demo of its own shows the answer after a moment.
  const shownDemo = unit.kind === 'demo' && !PLAYS_ITSELF.has(unit.exercise.input.kind);
  useEffect(() => {
    if (!shownDemo) return;
    const timer = window.setTimeout(() => setPhase('right'), SHOWN_DEMO_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  // Enter goes on from an explanation, as « Suivant » does.
  useEffect(() => {
    if (unit.kind !== 'explain') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      nextRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index]);

  const answer = (value: string, state?: WidgetState) => {
    if (unit.kind === 'explain' || phase !== 'asking') return;
    const skill = skills.get(unit.exercise.skill)!;
    if (unit.kind === 'demo' || skill.validate(unit.exercise, value)) {
      setPhase('right');
      return;
    }
    setMistakes(mistakes + 1);
    setTried({ ...state, answer: value });
    if (mistakes + 1 >= 2) setPhase('reveal');
  };

  let hint: SlateHint | null = null;
  let mood: Mood = 'talk';
  if (unit.kind !== 'explain') {
    const { exercise } = unit;
    const skill = skills.get(exercise.skill)!;
    const demo = unit.kind === 'demo';
    if (phase === 'right') {
      hint = { title: demo ? 'Voilà !' : 'Bravo !', text: unit.text, onNext: next };
      mood = 'cheer';
    } else if (phase === 'reveal') {
      hint = { title: 'On regarde ensemble.', text: skill.hint(exercise, 2), onNext: next };
    } else if (mistakes > 0) {
      hint = { title: 'Presque !', text: skill.hint(exercise, 1, tried) };
    } else if (unit.text && !coaches(exercise, demo)) {
      hint = { text: unit.text };
    } else if (!unit.text) {
      mood = 'calm';
    }
  }

  return (
    <Slate
      heading={
        <p class="instruction">
          {unit.kind === 'try' && !unit.text ? unit.exercise.instruction : lesson.title}
        </p>
      }
      mood={mood}
      hint={hint}
      away={false}
      basket={0}
      lesson
      over={<LessonFrame onClose={onClose} />}
    >
      {unit.kind === 'explain' ? (
        <>
          <Work wide={!unit.figure}>
            <Statement text={unit.text} />
            {unit.figure && <FigureView figure={unit.figure} />}
          </Work>
          <AnswerZone>
            <button type="button" class="submit" onPointerDown={next}>
              Suivant
            </button>
          </AnswerZone>
        </>
      ) : (
        <Widget
          key={index}
          exercise={unit.exercise}
          input={unit.exercise.input}
          locked={phase !== 'asking' || shownDemo}
          right={phase === 'right' && !shownDemo}
          shown={
            phase === 'reveal' || (shownDemo && phase === 'right') ? unit.exercise.answer : null
          }
          demo={unit.kind === 'demo'}
          onSubmit={answer}
        />
      )}
    </Slate>
  );
}

/**
 * On the frame of the slate during an astuce: not a question of the trail, and, opened from
 * the Carnet, a cross to close it (#203).
 */
function LessonFrame({ onClose }: { onClose?(): void }) {
  return (
    <>
      <div class="lesson-badge">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect class="cover" x="7" y="4" width="19" height="24" rx="3" />
          <path class="leaf" d="M12 20c0-6 4-9 10-10-1 6-4 10-10 10zM12 20l5-5" />
        </svg>
        Astuce de Plume
      </div>
      {onClose && (
        <button type="button" class="close" aria-label="Fermer" onPointerDown={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  );
}

interface OfferProps {
  lesson: Lesson;
  /** Played at once as its notion opens: announced, not offered (#203). */
  imposed: boolean;
  onAccept(): void;
  onDecline(): void;
}

/**
 * Between two questions, Plume offers her astuce (#51): refusing costs nothing. The one of a
 * notion that opens is only announced: what comes is not a question of the trail (#203).
 */
export function LessonOffer({ lesson, imposed, onAccept, onDecline }: OfferProps) {
  return (
    <section id="lesson-offer" class="card" aria-live="polite">
      <Plume mood="talk" />
      <p class="praise">{imposed ? 'Plume te montre une astuce !' : 'On regarde une astuce ?'}</p>
      <p class="title">{lesson.title}</p>
      {imposed && <p class="note">On découvre ensemble. Les feuilles reviennent juste après.</p>}
      <div class="actions">
        <button type="button" class="next" onPointerDown={onAccept}>
          {imposed ? 'C’est parti !' : 'D’accord !'}
        </button>
        {!imposed && (
          <button type="button" onPointerDown={onDecline}>
            Non merci
          </button>
        )}
      </div>
    </section>
  );
}

/** An astuce of the trail seen to the end: the questions, and their leaves, come back (#203). */
export function LessonEnd({ fresh, onGo }: { fresh: boolean; onGo(): void }) {
  return (
    <section id="lesson-end" class="card" aria-live="polite">
      <Plume mood="cheer" />
      <p class="praise">Astuce terminée !</p>
      <p class="title">On reprend le chemin.</p>
      <p class="note">{fresh && 'Elle est rangée dans ton carnet. '}Les feuilles reviennent !</p>
      <div class="actions">
        <button type="button" class="next" onPointerDown={onGo}>
          C’est parti !
        </button>
      </div>
    </section>
  );
}
