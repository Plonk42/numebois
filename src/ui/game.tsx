import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  LEAVES_PER_ELEMENT,
  LEAVES_PER_RIGHT_ANSWER,
  SEEDS_PER_ACHIEVEMENT,
} from '../core/economy';
import { Rng } from '../core/rng';
import { Session, type Achievement } from '../core/session';
import type { StepRole, TrailLength } from '../core/trail';
import type { Exercise, Skill } from '../core/types';
import { serializeSave, type ParsedSave } from '../save/save';
import { ParentMenu } from './parent-menu';
import { plural, Reserve, SeedIcon } from './reserve';
import { TrailPath } from './trail-path';
import { Choice } from './widgets/choice';
import { Keypad, grouped } from './widgets/keypad';
import './game.css';

/** Time to enjoy the praise before the next question, in milliseconds. */
const PRAISE_MS = 1100;
/** The card steps aside while the new element grows. */
const REWARD_MS = 3600;
/** The golden seed shows, then flies to the reserve. */
const SEED_SHOW_MS = 1700;
const SEED_FLY_MS = 1000;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];
const DAY_MS = 86_400_000;

type Phase = 'asking' | 'right' | 'reveal' | 'seed' | 'reward' | 'summary';

/** Read by the end-to-end tests. */
export interface GameProbe {
  exercise: Exercise | null;
  leaves: number;
  seeds: number;
  grown: number;
  phase: Phase;
  stone: number;
  stones: number;
  role: StepRole | null;
}

interface Gift {
  count: number;
  reason: string;
  leaving: boolean;
}

/** A moment of the reward sequence after a right answer. */
interface Step {
  phase: Phase;
  ms: number;
  start(): void;
}

/** Local day number: a new day starts at midnight on the tablet. */
function today(): number {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / DAY_MS);
}

interface Props {
  session: Session;
  skills: readonly Skill[];
  rng: Rng;
  leaves: number;
  seeds: number;
  /** Why the save could not be read, if it could not. */
  problem: string | null;
  grow(): void;
  save(json: string): void;
  probe: GameProbe;
}

/** Why golden seeds came: the first thing learnt. */
function giftReason(achievement: Achievement, skill: Skill): string {
  if (achievement.kind === 'automated') return 'Tu connais ce calcul par cœur.';
  return `Tu as appris : ${skill.name.charAt(0).toLowerCase()}${skill.name.slice(1)}.`;
}

/**
 * The trail: question after question along a path of stones; each right answer brings a
 * leaf to the reserve, each notion acquired or fact automated a golden seed, and a kind
 * summary closes the trail. Mistakes cost nothing: a hint, then the answer.
 */
function Game(props: Props) {
  const { session, rng, grow, probe } = props;
  const [grown, setGrown] = useState(0);
  const [grownHere, setGrownHere] = useState(0);
  const [leaves, setLeaves] = useState(props.leaves);
  const [seeds, setSeeds] = useState(props.seeds);
  const [leavesHere, setLeavesHere] = useState(0);
  const [seedsHere, setSeedsHere] = useState(0);
  const [gift, setGift] = useState<Gift | null>(null);
  const [round, setRound] = useState(0);
  const [{ skill, exercise }, setQuestion] = useState(() => session.ask());
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [praise, setPraise] = useState(PRAISES[0]);
  const [menu, setMenu] = useState(false);
  const [length, setLength] = useState<TrailLength>(session.length);
  const timer = useRef(0);
  const shownAt = useRef(performance.now());
  const firstAnswerMs = useRef<number | null>(null);

  const summary = phase === 'summary';
  useEffect(() => {
    Object.assign(probe, {
      exercise,
      leaves,
      seeds,
      grown,
      phase,
      stone: summary ? session.stones : session.stone,
      stones: session.stones,
      role: summary ? null : session.step.role,
    });
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const saveData = () =>
    serializeSave(
      { ...session.snapshot(), leaves, seeds, trailLength: session.length },
      new Date(),
    );
  // Every answer changes the phase or the reserve: the save follows.
  useEffect(() => props.save(saveData()), [leaves, seeds, phase, length]);

  const later = (ms: number, action: () => void) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(action, ms);
  };

  const ask = () => {
    setQuestion(session.ask(exercise));
    setMistakes(0);
    setRound((r) => r + 1);
    setPhase('asking');
    shownAt.current = performance.now();
    firstAnswerMs.current = null;
  };

  const proceed = () => {
    if (session.advance()) ask();
    else setPhase('summary');
  };

  const restart = () => {
    session.startTrail();
    setGrownHere(0);
    setLeavesHere(0);
    setSeedsHere(0);
    ask();
  };

  /** Plays the moments of a reward one after the other, then the next question. */
  const play = (steps: readonly Step[], i = 0) => {
    if (i === steps.length) {
      setGift(null);
      proceed();
      return;
    }
    steps[i].start();
    setPhase(steps[i].phase);
    later(steps[i].ms, () => play(steps, i + 1));
  };

  const answer = (value: string) => {
    if (phase !== 'asking') return;
    firstAnswerMs.current ??= performance.now() - shownAt.current;
    if (!skill.validate(exercise, value)) {
      setMistakes(mistakes + 1);
      if (mistakes + 1 >= 2) {
        session.conclude(skill, exercise, false, firstAnswerMs.current, true);
        setPhase('reveal');
      }
      return;
    }
    const achievements = session.conclude(
      skill,
      exercise,
      mistakes === 0,
      firstAnswerMs.current,
      false,
    );
    setPraise(rng.pick(PRAISES));
    setPhase('right');
    setLeaves(leaves + LEAVES_PER_RIGHT_ANSWER);
    const here = leavesHere + LEAVES_PER_RIGHT_ANSWER;
    setLeavesHere(here);
    const steps: Step[] = [];
    if (achievements.length > 0) {
      const count = achievements.length * SEEDS_PER_ACHIEVEMENT;
      const reason = giftReason(achievements[0], skill);
      steps.push(
        {
          phase: 'seed',
          ms: SEED_SHOW_MS,
          start: () => setGift({ count, reason, leaving: false }),
        },
        {
          phase: 'seed',
          ms: SEED_FLY_MS,
          start: () => {
            setSeeds((s) => s + count);
            setSeedsHere((s) => s + count);
            setGift((g) => g && { ...g, leaving: true });
          },
        },
      );
    }
    // Until the shop of the forest (#24, #25), a tree grows every few leaves of the trail.
    if (here % LEAVES_PER_ELEMENT === 0) {
      steps.push({
        phase: 'reward',
        ms: REWARD_MS,
        start: () => {
          grow();
          setGrown((g) => g + 1);
          setGrownHere((g) => g + 1);
        },
      });
    }
    later(PRAISE_MS, () => play(steps));
  };

  const revealed = mistakes >= 2;
  let hint: string | null = null;
  if (mistakes > 0) hint = skill.hint(exercise, revealed ? 2 : 1);
  const away = phase === 'reward' || phase === 'seed';
  return (
    <>
      <Reserve leaves={leaves} seeds={seeds} onLongPress={() => setMenu(true)} />
      <TrailPath stones={session.stones} current={summary ? session.stones : session.stone} />
      {gift && phase === 'seed' && <SeedGift {...gift} />}
      {menu && (
        <ParentMenu
          skills={props.skills}
          length={length}
          problem={props.problem}
          exportSave={saveData}
          onLength={(value) => {
            session.length = value;
            setLength(value);
          }}
          onClose={() => setMenu(false)}
        />
      )}
      {summary ? (
        <Summary
          stones={session.stones}
          leaves={leavesHere}
          seeds={seedsHere}
          grown={grownHere}
          onAgain={restart}
        />
      ) : (
        <section id="question" class={away ? 'away' : ''} aria-live="polite">
          {phase === 'right' ? (
            <p class="praise">{praise}</p>
          ) : (
            <p class="instruction">{exercise.instruction}</p>
          )}
          <p class="statement">{exercise.statement}</p>
          {hint && (
            <div class="hint">
              <strong>{revealed ? 'On regarde ensemble.' : 'Presque !'}</strong>
              <span>{hint}</span>
            </div>
          )}
          {phase === 'reveal' ? (
            <>
              <output class="answer shown" aria-label="La réponse">
                {exercise.input.kind === 'keypad' ? grouped(exercise.answer) : exercise.answer}
              </output>
              <button type="button" class="next" onPointerDown={proceed}>
                Suivant
              </button>
            </>
          ) : exercise.input.kind === 'keypad' ? (
            <Keypad
              key={round}
              maxDigits={exercise.input.maxDigits}
              locked={phase !== 'asking'}
              right={phase === 'right'}
              onSubmit={answer}
            />
          ) : (
            <Choice
              key={round}
              options={exercise.input.options}
              locked={phase !== 'asking'}
              right={phase === 'right'}
              onSubmit={answer}
            />
          )}
        </section>
      )}
    </>
  );
}

/** A golden seed, big in the middle of the forest, before it flies to the reserve. */
function SeedGift({ count, reason, leaving }: Gift) {
  return (
    <section id="seed-gift" class={leaving ? 'leaving' : ''} aria-live="polite">
      <SeedIcon />
      <p class="title">{count > 1 ? `${count} graines dorées !` : 'Une graine dorée !'}</p>
      <p class="reason">{reason}</p>
    </section>
  );
}

interface SummaryProps {
  stones: number;
  leaves: number;
  seeds: number;
  grown: number;
  onAgain(): void;
}

/** The end of a trail: what was done, never what was missed. */
function Summary({ stones, leaves, seeds, grown, onAgain }: SummaryProps) {
  let earned = '';
  if (leaves > 0 && seeds > 0) {
    earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')} et ${plural(seeds, 'graine dorée', 'graines dorées')}.`;
  } else if (leaves > 0) earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')}.`;
  let forest = '';
  if (grown === 1) forest = 'Ta forêt a un nouvel arbre.';
  else if (grown > 1) forest = `Ta forêt a ${grown} nouveaux arbres.`;
  return (
    <section id="question" class="summary" aria-live="polite">
      <p class="praise">Sentier terminé !</p>
      <p class="statement">Tu as franchi {stones} pierres.</p>
      {earned && <p class="instruction earned">{earned}</p>}
      {forest && <p class="instruction">{forest}</p>}
      <button type="button" class="next" onPointerDown={onAgain}>
        Encore un sentier
      </button>
    </section>
  );
}

/**
 * Mounts the game over the scene; `grow` makes the forest grow. A save that could not be
 * read is never overwritten: the game is played without saving, and the parent menu says why.
 */
export function mountGame(
  root: HTMLElement,
  skills: readonly Skill[],
  seed: number,
  grow: () => void,
  saved: ParsedSave | null,
  write: (json: string) => void,
) {
  const rng = new Rng(seed);
  const session = new Session(skills, rng.fork('trail'), today);
  if (saved?.ok) {
    session.restore(saved.data);
    session.length = saved.data.trailLength;
  }
  session.startTrail();
  const probe: GameProbe = {
    exercise: null,
    leaves: 0,
    seeds: 0,
    grown: 0,
    phase: 'asking',
    stone: 0,
    stones: session.stones,
    role: null,
  };
  const problem =
    saved && !saved.ok
      ? `La sauvegarde n’a pas pu être lue : ${saved.reason} Elle est gardée intacte.`
      : null;
  render(
    <Game
      session={session}
      skills={skills}
      rng={rng}
      leaves={saved?.ok ? saved.data.leaves : 0}
      seeds={saved?.ok ? saved.data.seeds : 0}
      problem={problem}
      grow={grow}
      save={problem ? () => undefined : write}
      probe={probe}
    />,
    root,
  );
  return probe;
}
