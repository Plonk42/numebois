import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ENERGY_PER_ELEMENT } from '../core/energy';
import { Rng } from '../core/rng';
import { Session } from '../core/session';
import type { StepRole, TrailLength } from '../core/trail';
import type { Exercise, Skill } from '../core/types';
import { serializeSave, type ParsedSave } from '../save/save';
import { EnergyGauge } from './energy-gauge';
import { ParentMenu } from './parent-menu';
import { TrailPath } from './trail-path';
import { Keypad, grouped } from './widgets/keypad';
import './game.css';

/** Time to enjoy the praise before the next question, in milliseconds. */
const PRAISE_MS = 1100;
/** The card steps aside while the new element grows. */
const REWARD_MS = 3600;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];
const DAY_MS = 86_400_000;

type Phase = 'asking' | 'right' | 'reveal' | 'reward' | 'summary';

/** Read by the end-to-end tests. */
export interface GameProbe {
  exercise: Exercise | null;
  energy: number;
  grown: number;
  phase: Phase;
  stone: number;
  stones: number;
  role: StepRole | null;
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
  energy: number;
  /** Why the save could not be read, if it could not. */
  problem: string | null;
  grow(): void;
  save(json: string): void;
  probe: GameProbe;
}

/**
 * The trail: question after question along a path of stones; each right answer adds a leaf
 * to the gauge, a full gauge grows a tree, and a kind summary closes the trail. Mistakes
 * cost nothing: a hint, then the answer.
 */
function Game(props: Props) {
  const { session, rng, grow, probe } = props;
  const [grown, setGrown] = useState(0);
  const [grownHere, setGrownHere] = useState(0);
  const [energy, setEnergy] = useState(props.energy);
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
      energy,
      grown,
      phase,
      stone: summary ? session.stones : session.stone,
      stones: session.stones,
      role: summary ? null : session.step.role,
    });
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const saveData = () =>
    serializeSave({ ...session.snapshot(), energy, trailLength: session.length }, new Date());
  // Every answer changes the phase or the energy: the save follows.
  useEffect(() => props.save(saveData()), [energy, phase, length]);

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
    ask();
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
    session.conclude(skill, exercise, mistakes === 0, firstAnswerMs.current, false);
    setPraise(rng.pick(PRAISES));
    setPhase('right');
    const filled = energy + 1;
    setEnergy(filled);
    if (filled < ENERGY_PER_ELEMENT) {
      later(PRAISE_MS, proceed);
      return;
    }
    later(PRAISE_MS, () => {
      grow();
      setPhase('reward');
      setEnergy(0);
      setGrown(grown + 1);
      setGrownHere(grownHere + 1);
      later(REWARD_MS, proceed);
    });
  };

  const revealed = mistakes >= 2;
  let hint: string | null = null;
  if (mistakes > 0) hint = skill.hint(exercise, revealed ? 2 : 1);
  return (
    <>
      <EnergyGauge energy={energy} onLongPress={() => setMenu(true)} />
      <TrailPath stones={session.stones} current={summary ? session.stones : session.stone} />
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
        <Summary stones={session.stones} grown={grownHere} onAgain={restart} />
      ) : (
        <section id="question" class={phase === 'reward' ? 'away' : ''} aria-live="polite">
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
                {grouped(exercise.answer)}
              </output>
              <button type="button" class="next" onPointerDown={proceed}>
                Suivant
              </button>
            </>
          ) : (
            exercise.input.kind === 'keypad' && (
              <Keypad
                key={round}
                maxDigits={exercise.input.maxDigits}
                locked={phase !== 'asking'}
                right={phase === 'right'}
                onSubmit={answer}
              />
            )
          )}
        </section>
      )}
    </>
  );
}

interface SummaryProps {
  stones: number;
  grown: number;
  onAgain(): void;
}

/** The end of a trail: what was done, never what was missed. */
function Summary({ stones, grown, onAgain }: SummaryProps) {
  let forest = 'Ta forêt a gagné des feuilles.';
  if (grown === 1) forest = 'Ta forêt a un nouvel arbre.';
  else if (grown > 1) forest = `Ta forêt a ${grown} nouveaux arbres.`;
  return (
    <section id="question" class="summary" aria-live="polite">
      <p class="praise">Sentier terminé !</p>
      <p class="statement">Tu as franchi {stones} pierres.</p>
      <p class="instruction">{forest}</p>
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
    energy: 0,
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
      energy={saved?.ok ? saved.data.energy : 0}
      problem={problem}
      grow={grow}
      save={problem ? () => undefined : write}
      probe={probe}
    />,
    root,
  );
  return probe;
}
