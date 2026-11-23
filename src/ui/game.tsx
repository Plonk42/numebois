import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ENERGY_PER_ELEMENT } from '../core/energy';
import { Rng } from '../core/rng';
import type { Exercise, Skill } from '../core/types';
import { EnergyGauge } from './energy-gauge';
import { Keypad, grouped } from './widgets/keypad';
import './game.css';

/** Time to enjoy the praise before the next question, in milliseconds. */
const PRAISE_MS = 1100;
/** The card steps aside while the new element grows. */
const REWARD_MS = 3600;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];

type Phase = 'asking' | 'right' | 'reveal' | 'reward';

/** Read by the end-to-end tests. */
export interface GameProbe {
  exercise: Exercise | null;
  energy: number;
  grown: number;
}

interface Props {
  /** The first one asks the first question. */
  skills: readonly Skill[];
  rng: Rng;
  grow(): void;
  probe: GameProbe;
}

/**
 * First playable loop: question after question; each right answer adds a leaf to the gauge,
 * a full gauge grows a tree. Mistakes cost nothing: a hint, then the answer.
 */
function Game({ skills, rng, grow, probe }: Props) {
  const [grown, setGrown] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [round, setRound] = useState(0);
  const [skill, setSkill] = useState(skills[0]);
  const [exercise, setExercise] = useState(() => skills[0].generate(rng, 0));
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [praise, setPraise] = useState(PRAISES[0]);
  const timer = useRef(0);

  useEffect(() => {
    probe.exercise = exercise;
    probe.energy = energy;
    probe.grown = grown;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const later = (ms: number, action: () => void) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(action, ms);
  };

  // Until the trail chooses (#15): another notion each time, each tree grown opens a level.
  const next = (unlocked: number) => {
    const others = skills.filter((s) => s !== skill);
    const chosen = others.length > 0 ? rng.pick(others) : skill;
    let candidate = exercise;
    while (candidate.statement === exercise.statement) {
      candidate = chosen.generate(rng, rng.int(0, Math.min(chosen.levels - 1, unlocked)));
    }
    setSkill(chosen);
    setExercise(candidate);
    setMistakes(0);
    setRound((r) => r + 1);
    setPhase('asking');
  };

  const answer = (value: string) => {
    if (phase !== 'asking') return;
    if (!skill.validate(exercise, value)) {
      setMistakes(mistakes + 1);
      if (mistakes + 1 >= 2) setPhase('reveal');
      return;
    }
    setPraise(rng.pick(PRAISES));
    setPhase('right');
    const filled = energy + 1;
    setEnergy(filled);
    if (filled < ENERGY_PER_ELEMENT) {
      later(PRAISE_MS, () => next(grown));
      return;
    }
    later(PRAISE_MS, () => {
      grow();
      setPhase('reward');
      setEnergy(0);
      setGrown(grown + 1);
      later(REWARD_MS, () => next(grown + 1));
    });
  };

  const revealed = mistakes >= 2;
  const hint = mistakes > 0 ? skill.hint(exercise, revealed ? 2 : 1) : null;
  return (
    <>
      <EnergyGauge energy={energy} />
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
            <button type="button" class="next" onPointerDown={() => next(grown)}>
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
    </>
  );
}

/** Mounts the game over the scene; `grow` makes the forest grow. */
export function mountGame(
  root: HTMLElement,
  skills: readonly Skill[],
  seed: number,
  grow: () => void,
) {
  const probe: GameProbe = { exercise: null, energy: 0, grown: 0 };
  render(<Game skills={skills} rng={new Rng(seed)} grow={grow} probe={probe} />, root);
  return probe;
}
