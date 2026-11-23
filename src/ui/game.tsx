import { render, type ComponentChildren } from 'preact';
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
import type { AnimalName } from '../scene/animal-catalog';
import { MAX_ELEMENTS, type SceneDescription } from '../scene/description';
import { canBuy, shopItems, type ShopItem } from '../scene/shop';
import type { Season } from '../scene/trees/builder';
import { ParentMenu } from './parent-menu';
import { Plume, type PlumeMood } from './plume';
import { plural, Reserve, SeedIcon } from './reserve';
import { SEASON_LABELS, SeasonPicker } from './seasons';
import { ANIMAL_LABELS, Shop } from './shop';
import { Slate, type SlateHint } from './slate';
import { Spots, type SpotsForest } from './spots';
import { TrailPath } from './trail-path';
import { Widget } from './widgets';
import './game.css';

/** Time to enjoy the praise before the next question, in milliseconds. */
const PRAISE_MS = 1100;
/** The golden seed shows, then flies to the reserve. */
const SEED_SHOW_MS = 1700;
const SEED_FLY_MS = 1000;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];
const DAY_MS = 86_400_000;

type Phase =
  | 'asking'
  | 'right'
  | 'reveal'
  | 'seed'
  | 'summary'
  | 'choosing'
  | 'planting'
  | 'adopting'
  | 'turning';

/** Phases of the end of the trail, when the forest has the stage. */
const SUMMARY_PHASES: readonly Phase[] = ['summary', 'choosing', 'planting', 'adopting', 'turning'];

/** The painting in progress, as the game sees it. */
export interface GameForest extends SpotsForest {
  description(): SceneDescription;
  /** Free slots offered for the next element. */
  candidates(): readonly number[];
  /** Places an element; resolves once it has grown (and the stage has passed). */
  plant(slot: number, day: number): Promise<unknown>;
  /** Brings a bought animal into the meadow; resolves once it has settled. */
  adopt(animal: AnimalName): Promise<unknown>;
  /** Shows the painting in another season (a bought one joins its seasons); resolves once shown. */
  changeSeason(season: Season): Promise<unknown>;
  /** Picture of an animal for the shop, null while the animals load. */
  portrait(animal: AnimalName): string | null;
  /** Short sound of a reward of the trail. */
  reward(kind: 'right' | 'seed'): void;
}

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
  forest: GameForest;
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
 * summary closes the trail, with the shop of the forest where the reserve is spent. Mistakes
 * cost nothing: a hint, then the answer.
 */
function Game(props: Props) {
  const { session, rng, forest, probe } = props;
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
  const [spots, setSpots] = useState<readonly number[]>([]);
  const [arrival, setArrival] = useState<string | null>(null);
  const timer = useRef(0);
  const shownAt = useRef(performance.now());
  const firstAnswerMs = useRef<number | null>(null);

  const summary = SUMMARY_PHASES.includes(phase);
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
      {
        ...session.snapshot(),
        leaves,
        seeds,
        trailLength: session.length,
        painting: forest.description(),
      },
      new Date(),
    );
  // Every answer changes the phase or the reserve, every element the phase: the save follows.
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

  /** One touch in the shop: an element waits for its place, an animal or a season comes at once. */
  const buy = (item: ShopItem) => {
    if (phase !== 'summary' || !canBuy(item, leaves, seeds)) return;
    const { article } = item;
    if (article.kind === 'element') {
      const slots = forest.candidates();
      if (slots.length === 0) return;
      setSpots(slots);
      setPhase('choosing');
      return;
    }
    setLeaves(leaves - item.leaves);
    setSeeds(seeds - item.seeds);
    if (article.kind === 'season') {
      setArrival(`${SEASON_LABELS[article.season]} arrive !`);
      turn(article.season);
      return;
    }
    setArrival(`${ANIMAL_LABELS[article.animal]} arrive !`);
    setPhase('adopting');
    void forest.adopt(article.animal).then(() => {
      setGrownHere((g) => g + 1);
      setArrival(null);
      setPhase('summary');
    });
  };

  /** The painting passes to another of its seasons. */
  const turn = (season: Season) => {
    setPhase('turning');
    void forest.changeSeason(season).then(() => {
      setArrival(null);
      setPhase('summary');
    });
  };

  const plant = (slot: number) => {
    if (phase !== 'choosing') return;
    setSpots([]);
    setLeaves(leaves - LEAVES_PER_ELEMENT);
    setPhase('planting');
    void forest.plant(slot, today()).then(() => {
      setGrown((g) => g + 1);
      setGrownHere((g) => g + 1);
      setPhase('summary');
    });
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
    forest.reward('right');
    setLeaves(leaves + LEAVES_PER_RIGHT_ANSWER);
    setLeavesHere(leavesHere + LEAVES_PER_RIGHT_ANSWER);
    const steps: Step[] = [];
    if (achievements.length > 0) {
      const count = achievements.length * SEEDS_PER_ACHIEVEMENT;
      const reason = giftReason(achievements[0], skill);
      steps.push(
        {
          phase: 'seed',
          ms: SEED_SHOW_MS,
          start: () => {
            setGift({ count, reason, leaving: false });
            forest.reward('seed');
          },
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
    later(PRAISE_MS, () => play(steps));
  };

  const revealed = mistakes >= 2;
  let hint: SlateHint | null = null;
  if (mistakes > 0) {
    hint = {
      title: revealed ? 'On regarde ensemble.' : 'Presque !',
      text: skill.hint(exercise, revealed ? 2 : 1),
      onNext: phase === 'reveal' ? proceed : undefined,
    };
  }
  const placed = forest.description().elements.length;
  const { season, seasons } = forest.description();
  // A golden seed: the slate steps aside, the forest lights up.
  const away = phase === 'seed';
  let plume: PlumeMood = 'calm';
  if (phase === 'right' || away) plume = 'cheer';
  else if (hint) plume = 'talk';
  return (
    <>
      <Reserve leaves={leaves} seeds={seeds} onLongPress={() => setMenu(true)} />
      <SeasonPicker
        seasons={seasons}
        season={season}
        active={phase === 'summary'}
        onPick={(s) => {
          if (phase === 'summary') turn(s);
        }}
      />
      <TrailPath stones={session.stones} current={summary ? session.stones : session.stone} />
      {/* During a question, the forest dims: one thing at a time. */}
      <div id="dim" class={summary || away ? '' : 'on'} />
      {gift && phase === 'seed' && <SeedGift {...gift} />}
      {phase === 'choosing' && <Spots forest={forest} slots={spots} onPick={plant} />}
      {arrival && (
        <section id="arrival" aria-live="polite">
          <p class="title">{arrival}</p>
        </section>
      )}
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
          complete={placed >= MAX_ELEMENTS}
          away={phase !== 'summary'}
          onAgain={restart}
        >
          <Shop
            items={shopItems(forest.description())}
            leaves={leaves}
            seeds={seeds}
            portrait={(animal) => forest.portrait(animal)}
            onBuy={buy}
          />
        </Summary>
      ) : (
        <Slate
          away={away}
          heading={
            phase === 'right' ? (
              <p class="praise">{praise}</p>
            ) : (
              <p class="instruction">{exercise.instruction}</p>
            )
          }
          plume={plume}
          hint={hint}
        >
          <Widget
            key={round}
            exercise={exercise}
            input={exercise.input}
            locked={phase !== 'asking'}
            right={phase === 'right'}
            shown={phase === 'reveal' ? exercise.answer : null}
            onSubmit={answer}
          />
        </Slate>
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
  /** Earned on this trail. */
  leaves: number;
  seeds: number;
  /** Elements grown and animals come since the end of this trail. */
  grown: number;
  /** Every slot of the painting holds an element. */
  complete: boolean;
  /** The forest has the stage: the card steps aside. */
  away: boolean;
  onAgain(): void;
  /** The shop of the forest. */
  children: ComponentChildren;
}

/**
 * The end of a trail, over the whole forest: what was done, never what was missed, then the
 * shop of the forest; another trail stays one touch away.
 */
function Summary(props: SummaryProps) {
  const { stones, leaves, seeds, grown } = props;
  let earned = '';
  if (leaves > 0 && seeds > 0) {
    earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')} et ${plural(seeds, 'graine dorée', 'graines dorées')}.`;
  } else if (leaves > 0) earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')}.`;
  let forest = '';
  if (props.complete) forest = 'Ton tableau est complet !';
  else if (grown > 0) forest = 'Ta forêt a grandi !';
  return (
    <section id="trail-end" class={props.away ? 'away' : ''} aria-live="polite">
      <Plume mood="cheer" />
      <p class="praise">Sentier terminé !</p>
      <p class="statement text">Tu as franchi {stones} pierres.</p>
      {earned && <p class="instruction earned">{earned}</p>}
      {forest && <p class="instruction">{forest}</p>}
      {props.children}
      <button type="button" class="next" onPointerDown={props.onAgain}>
        Encore un sentier
      </button>
    </section>
  );
}

/**
 * Mounts the game over the scene, which shows `forest`, the painting in progress. A save that
 * could not be read is never overwritten: the game is played without saving, and the parent
 * menu says why.
 */
export function mountGame(
  root: HTMLElement,
  skills: readonly Skill[],
  seed: number,
  forest: GameForest,
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
      forest={forest}
      save={problem ? () => undefined : write}
      probe={probe}
    />,
    root,
  );
  return probe;
}
