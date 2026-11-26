import { render, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isoDate, today } from '../core/day';
import {
  Challenge,
  challengeable,
  FLASH_MS,
  FLASH_SHARE,
  offers,
  squirrelComes,
} from '../core/challenge';
import { Drill, suggestedBranch, type DrillTarget } from '../core/drill';
import { cleanName, named } from '../core/name';
import { modeOf, settingOf, type SkillSetting } from '../core/settings';
import {
  LEAVES_PER_ACORN,
  leavesPerElement,
  SEEDS_PER_ACHIEVEMENT,
  SEEDS_PER_CHALLENGE,
  LEAVES_PER_FLASH,
} from '../core/economy';
import { Rng } from '../core/rng';
import {
  bestOf,
  challengeLevel,
  ending,
  firstOfDay,
  type Attempt,
  type ChallengeFormat,
  type Ending,
} from '../core/records';
import { Session, type Achievement, type SessionSnapshot } from '../core/session';
import { stepLevel, type StepRole, type TrailLength } from '../core/trail';
import type { Exercise, Skill, SkillId } from '../core/types';
import { QUESTS } from '../quests';
import {
  exportFile,
  isFramed,
  serializeAlbum,
  type AlbumEntry,
  type ParsedAlbum,
} from '../save/album';
import type { Recommended } from '../save/parent';
import { serializeSave, type PaintingJournal, type ParsedSave } from '../save/save';
import type { AnimalName } from '../scene/animal-catalog';
import { BIOMES, nextBiomes } from '../scene/biomes';
import {
  choicesOf,
  completed,
  DEFAULT_DESCRIPTION,
  isComplete,
  newPainting,
  shownChoice,
  type RareName,
  type SceneDescription,
  type SeasonChoice,
} from '../scene/description';
import { canBuy, shopItems, type ShopItem } from '../scene/shop';
import type { Quality } from '../scene/render/quality';
import type { TrailArt } from '../scene/render/trail-art';
import { AlbumButton, AlbumGrid, AlbumPage } from './album';
import { Basket } from './basket';
import {
  CHALLENGE_NAME,
  ChallengeBar,
  ChallengeEnd,
  ChallengeOffer,
  FlashBadge,
  RaceBar,
} from './challenge';
import { DrillBreak, DrillTree, Garland, TuftButton, DRILL_NAME } from './drill';
import { FinaleBanner, Frame, NextPainting, type NextChoice } from './finale';
import { Naming } from './naming';
import { ParentMenu } from './parent-menu';
import { Plume, type Mood } from './character';
import { RARE_ARRIVALS } from './rares';
import { plural, Reserve, SeedIcon } from './reserve';
import { SEASON_LABELS, SeasonPicker } from './seasons';
import { ANIMAL_LABELS, Shop } from './shop';
import { Slate, type SlateHint } from './slate';
import { Spots, type SpotsForest } from './spots';
import { TrailPath } from './trail-path';
import { Widget } from './widgets';
import './album.css';
import './game.css';

/** Time to enjoy the praise before the next question, in milliseconds. */
const PRAISE_MS = 1100;
/** The golden seed shows, then flies to the reserve. */
const SEED_SHOW_MS = 1700;
const SEED_FLY_MS = 1000;
/** At the end of the trail, Plume pours her basket into the reserve, leaf after leaf. */
const POUR_START_MS = 700;
const POUR_STEP_MS = 150;
/** A big basket (a long drill) pours by handfuls: never more steps than this. */
const POUR_STEPS = 12;
/** Then « Sentier terminé ! » stays a moment before the forest is all the child's. */
const DONE_MS = 2000;
/** The finished painting stays framed a moment, then the light comes over it. */
const FRAMED_MS = 3500;
/** Time for the light to cover the scene before a painting is built under it (#veil). */
const COVER_MS = 750;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];
/** « Bonjour, Prénom ! » at the top of the landscape when the game opens. */
const GREETING_MS = 2500;
/** In a drill, the next question comes quickly; a missed answer shows a moment. */
const DRILL_RIGHT_MS = 400;
const DRILL_REVEAL_MS = 1800;
/** Questions of a round of the drill: then another one, or the end. */
export const DRILL_ROUND = 20;
/** After this long in a drill, Plume offers a pause once. */
const DRILL_PAUSE_MS = 15 * 60_000;
/** In a challenge, the next question comes at once; the sun moves this often. */
const CHALLENGE_RIGHT_MS = 300;
const CHALLENGE_TICK_MS = 250;

/** Whose questions the slate asks. */
type Mode = 'trail' | 'drill' | 'challenge';
const DONE_TITLES: Record<Mode, string> = {
  trail: 'Sentier terminé !',
  drill: 'Belle récolte !',
  challenge: 'Défi terminé !',
};

/** How a challenge ended, and what to aim at next time. */
interface ChallengeResult {
  format: ChallengeFormat;
  attempt: Attempt;
  ending: Ending;
  /** The squirrel's acorns of the challenge. */
  acorns: number;
  /** The first challenge of the day: the squirrel exchanges its acorns and gives a golden seed. */
  gift: boolean;
}

type Phase =
  | 'naming'
  | 'walking'
  | 'asking'
  | 'right'
  | 'reveal'
  | 'seed'
  | 'drill-menu'
  | 'break'
  | 'challenge-menu'
  | 'challenge-end'
  | 'squirrel'
  | 'shop'
  | 'choosing'
  | 'planting'
  | 'adopting'
  | 'turning'
  | 'finale'
  | 'framing'
  | 'next'
  | 'album'
  | 'visiting';

/** A trail or a drill in progress: the slate and its rewards. */
const TRAIL_PHASES = new Set<Phase>(['asking', 'right', 'reveal', 'seed']);
/** The shop, opened from the reserve between two trails, and what it brings to the painting. */
const SHOP_PHASES = new Set<Phase>(['shop', 'choosing', 'planting', 'adopting', 'turning']);
/** A complete painting: the grand finale, its frame, then the choice of the next one (#33). */
const FINALE_PHASES = new Set<Phase>(['finale', 'framing', 'next']);
/** Time counted at most for one question in the parent dashboard. */
const QUESTION_MS_MAX = 120_000;
/** Answer times, the drill's pause and the challenges: the wall clock, that tests set. */
const playClock = () => Date.now();

/** The Album, then one of its paintings alive again (#34). */
const ALBUM_PHASES = new Set<Phase>(['album', 'visiting']);

/** The painting in progress, as the game sees it. */
export interface GameForest extends SpotsForest {
  description(): SceneDescription;
  /** Free slots offered for the next element. */
  candidates(): readonly number[];
  /** Places an element; resolves once it has grown (and the stage has passed). */
  plant(slot: number, day: number): Promise<unknown>;
  /** Brings a bought animal into the meadow; resolves once it has settled. */
  adopt(animal: AnimalName): Promise<unknown>;
  /** Shows the painting in another season or at night (a bought one joins); resolves once shown. */
  changeSeason(choice: SeasonChoice): Promise<unknown>;
  /** Brings a bought rare element into the painting; resolves once shown. */
  addRare(rare: RareName): Promise<unknown>;
  /** Picture of an animal for the shop, null while the animals load. */
  portrait(animal: AnimalName): string | null;
  /** The trail and its sign drawn with the models of the forest, null while they load. */
  trailArt(stones: number): TrailArt | null;
  /** The models are loaded and the painting built. */
  ready: Promise<unknown>;
  /** The grand finale of the complete painting; resolves once it is over. */
  finale(): Promise<unknown>;
  /** The painting shown, at its framing, as a small image. */
  picture(): string;
  /** Shows another painting (Album, next one; null: the one in progress), built at once. */
  show(description: SceneDescription | null): void;
  /** A new painting in progress, built at once. */
  start(description: SceneDescription): void;
  /** The light over the whole scene, to build another painting under it. */
  cover(on: boolean): void;
  /** Short sound of a reward of the trail. */
  reward(kind: 'right' | 'seed'): void;
  /**
   * Gestures explore the forest, told when the view leaves or comes back to the framing;
   * null stops them and the view glides back.
   */
  explore(onAway: ((away: boolean) => void) | null): void;
  /** Back to the framing. */
  recenter(): void;
  /** Quality chosen in the parent menu, and the tier drawn now (the automatic one steps down). */
  quality(): { chosen: Quality | 'auto'; current: Quality };
  setQuality(quality: Quality | 'auto'): void;
}

/** Read by the end-to-end tests. */
export interface GameProbe {
  exercise: Exercise | null;
  leaves: number;
  seeds: number;
  /** Leaves of the trail in Plume's basket, not poured into the reserve yet. */
  basket: number;
  grown: number;
  phase: Phase;
  /** The questions are those of a drill, not of the trail. */
  drilling: boolean;
  mode: Mode;
  /** The question asked is a flash bonus. */
  flash: boolean;
  /** Questions shown so far: the same fact asked again is still another question. */
  asked: number;
  stone: number;
  stones: number;
  role: StepRole | null;
  /** Leaves a right answer to the trail's question earns, a flash bonus aside (#141). */
  worth: number;
}

/** Shortcuts of the sandbox (`?sandbox`), wired by the game. */
export interface GameDebug {
  /** Starts the trail waiting, between two trails. */
  start(): void;
  /** Answers the question asked, right or wrong; nothing outside a question. */
  answer(right: boolean): void;
  /** Adds to the reserve. */
  give(leaves: number, seeds: number): void;
  /** Progress of the notions and facts. */
  progress(): SessionSnapshot;
  /** Notion and level of the step in progress. */
  step(): { skill: SkillId; level: number };
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

interface Props {
  session: Session;
  skills: readonly Skill[];
  rng: Rng;
  leaves: number;
  seeds: number;
  /** The drill the parent recommends (#47). */
  recommended: Recommended | null;
  journal: PaintingJournal;
  album: readonly AlbumEntry[];
  /** Why the save could not be read, if it could not. */
  problem: string | null;
  forest: GameForest;
  save(json: string): void;
  saveAlbum(entries: readonly AlbumEntry[]): void;
  probe: GameProbe;
  /** Opens on the landscape, between two trails, rather than on the first question. */
  home: boolean;
  /** The child's first name, empty when not given. */
  name: string;
  /** Plume asks the first name first. */
  askName: boolean;
  debug?: GameDebug;
}

/** Why golden seeds came: the first thing learnt. */
function giftReason(achievement: Achievement, skill: Skill): string {
  if (achievement.kind === 'automated') return 'Celle-là, tu la sais par cœur !';
  const name = `${skill.name.charAt(0).toLowerCase()}${skill.name.slice(1)}`;
  if (achievement.kind === 'level') return `Tu montes d’un cran : ${name}.`;
  return `Tu as appris : ${name}.`;
}

/**
 * Between two trails, the landscape is the child's, always laid out the same: a walk with the
 * fingers, the reserve (top left) opens the shop where it is spent, the trail waits at the
 * bottom with its sign. A touch on it starts the trail: question after question along its
 * stones; each right answer brings a leaf to the reserve, each notion acquired or fact
 * automated a golden seed. Mistakes cost nothing: a hint, then the answer.
 */
function Game(props: Props) {
  const { session, rng, forest, probe } = props;
  const [grown, setGrown] = useState(0);
  const [leaves, setLeaves] = useState(props.leaves);
  const [seeds, setSeeds] = useState(props.seeds);
  const [leavesHere, setLeavesHere] = useState(0);
  const [seedsHere, setSeedsHere] = useState(0);
  /** Saved in `leaves` at once, shown in Plume's basket until the end of the trail. */
  const [basket, setBasket] = useState(0);
  const [gift, setGift] = useState<Gift | null>(null);
  const [round, setRound] = useState(0);
  const [{ skill, exercise }, setQuestion] = useState(() => session.ask());
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => {
    if (isComplete(forest.description())) return 'finale';
    if (props.askName) return 'naming';
    return props.home ? 'walking' : 'asking';
  });
  const [praise, setPraise] = useState(PRAISES[0]);
  const [name, setName] = useState(props.name);
  /** « Bonjour, Prénom ! » shows a moment when the game opens, once the landscape is there. */
  const [greeting, setGreeting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [length, setLength] = useState<TrailLength>(session.length);
  const [art, setArt] = useState<TrailArt | null>(null);
  const [spots, setSpots] = useState<readonly number[]>([]);
  const [arrival, setArrival] = useState<string | null>(null);
  /** The trail is over: the next one is drawn when the child starts it. */
  const [finished, setFinished] = useState(false);
  const [viewAway, setViewAway] = useState(false);
  /** « Sentier terminé ! » shows while Plume pours her basket, then goes. */
  const [done, setDone] = useState(false);
  const [journal, setJournal] = useState(props.journal);
  const [album, setAlbum] = useState(props.album);
  const [choices, setChoices] = useState<readonly NextChoice[]>([]);
  const [page, setPage] = useState<AlbumEntry | null>(null);
  /** Where a change of season started: the screen stays as it was under the light. */
  const [turnFrom, setTurnFrom] = useState<Phase>('walking');
  /** The drill in progress, its garland of right answers in the round, and how its last round ends. */
  const drill = useRef<Drill | null>(null);
  /** Whose questions the slate asks. */
  const [mode, setMode] = useState<Mode>('trail');
  const drilling = mode === 'drill';
  const [garland, setGarland] = useState(0);
  const [pause, setPause] = useState(false);
  const drillStart = useRef(0);
  const pauseOffered = useRef(false);
  /** The stones of a round of the drill, drawn like the trail's (#131). */
  const [drillArt, setDrillArt] = useState<TrailArt | null>(null);
  /** The challenge in progress, then how it ended. */
  const challenge = useRef<Challenge | null>(null);
  /** Its end is counted once: the sun's tick may fire again before the next render. */
  const challengeEnded = useRef(false);
  const [challengeEnd, setChallengeEnd] = useState<ChallengeResult | null>(null);
  const [, setTick] = useState(0);
  /** Where the squirrel's offers are: they take turns, from one opening to the next (#132). */
  const [offerAt, setOfferAt] = useState(() => rng.int(0, 999));
  /** The squirrel passes once per session after a trail ended well. */
  const offered = useRef(false);
  /** The squirrel comes when the shop closes; another trail, drill or challenge sends it away. */
  const squirrelWaits = useRef(false);
  /** The question asked is a flash bonus; one per trail at most. */
  const [flash, setFlash] = useState(false);
  const flashUsed = useRef(false);
  /** What ended last: the summary says it. */
  const [ended, setEnded] = useState<Mode>('trail');
  const phaseNow = useRef(phase);
  phaseNow.current = phase;
  const timer = useRef(0);
  const shownAt = useRef(playClock());
  const firstAnswerMs = useRef<number | null>(null);
  const [recommended, setRecommended] = useState(props.recommended);
  /** The play in progress, for the parent dashboard: questions, right first, time spent. */
  const tally = useRef({ questions: 0, right: 0, ms: 0 });
  const count = (right: boolean) => {
    const t = tally.current;
    t.questions++;
    if (right) t.right++;
    // A tablet forgotten on a question does not count for hours.
    t.ms += Math.min(Math.max(0, playClock() - shownAt.current), QUESTION_MS_MAX);
  };
  const logPlay = (kind: Mode) => {
    const t = tally.current;
    if (t.questions > 0) session.addPlay({ day: today(), kind, ...t, ms: Math.round(t.ms) });
    tally.current = { questions: 0, right: 0, ms: 0 };
  };

  const walking = phase === 'walking';
  const browsing = ALBUM_PHASES.has(phase);
  const shown = phase === 'turning' ? turnFrom : phase;
  const onTrail = TRAIL_PHASES.has(phase);
  /** The landscape is the child's: the reserve opens the shop, the trail and the Album wait. */
  const free = walking && !done;
  /** The seasons answer during a walk and in the shop. */
  const canTurn = free || phase === 'shop';
  /** Gestures move the view during a walk, in the forest or in a painting of the Album. */
  const roaming = walking || phase === 'visiting';
  useEffect(() => {
    Object.assign(probe, {
      exercise,
      leaves,
      seeds,
      basket,
      grown,
      phase,
      mode,
      flash,
      drilling,
      asked: round,
      stone: finished ? session.stones : session.stone,
      stones: session.stones,
      role: finished ? null : session.step.role,
      worth: session.worth,
    });
  });
  useEffect(() => {
    if (!props.debug) return;
    Object.assign(props.debug, {
      start,
      answer: (right: boolean) => answer(right ? exercise.answer : ''),
      give: (more: number, moreSeeds: number) => {
        setLeaves((l) => l + more);
        setSeeds((s) => s + moreSeeds);
      },
    });
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    let live = true;
    void forest.ready.then(() => live && setArt(forest.trailArt(session.stones)));
    return () => {
      live = false;
    };
  }, [session.stones]);
  // After the walk, the view glides back to the framing.
  useEffect(() => {
    forest.explore(roaming ? setViewAway : null);
    if (!roaming) setViewAway(false);
  }, [roaming]);
  // The sun crosses the sky; the basket's time may run out while the child thinks.
  useEffect(() => {
    if (mode !== 'challenge' || phase !== 'asking') return;
    const id = window.setInterval(() => {
      if (challenge.current?.over) finishChallenge();
      else setTick((t) => t + 1);
    }, CHALLENGE_TICK_MS);
    return () => clearInterval(id);
  }, [mode, phase]);
  // The game hidden, the challenge's time stops.
  useEffect(() => {
    if (mode !== 'challenge') return;
    const onVisibility = () => {
      if (document.hidden) challenge.current?.pause();
      else if (phaseNow.current === 'asking') challenge.current?.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [mode]);
  useEffect(() => {
    if (phase !== 'walking' || !name) return;
    let live = true;
    void forest.ready.then(() => live && setGreeting(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!greeting) return;
    const id = window.setTimeout(() => setGreeting(false), GREETING_MS);
    return () => clearTimeout(id);
  }, [greeting]);
  // A painting completed before the game stopped: its grand finale, or the next one to choose.
  useEffect(() => {
    if (!isComplete(forest.description())) return;
    void forest.ready.then(() => {
      if (isFramed(album, forest.description())) chooseNext(album);
      else finish();
    });
  }, []);

  const saveData = () =>
    serializeSave(
      {
        ...session.snapshot(),
        leaves,
        seeds,
        trailLength: session.length,
        painting: forest.description(),
        journal,
        recommended,
        name,
      },
      new Date(),
    );
  // Every answer changes the phase or the reserve, every element the phase: the save follows.
  useEffect(
    () => props.save(saveData()),
    [leaves, seeds, phase, length, journal, recommended, name],
  );
  // The end of the trail: the basket empties into the reserve, then the forest is the child's.
  useEffect(() => {
    if (!done) return;
    if (basket === 0) {
      const id = window.setTimeout(() => {
        setDone(false);
        if (ended === 'trail') afterTrail();
      }, DONE_MS);
      return () => clearTimeout(id);
    }
    const id = window.setTimeout(
      () => setBasket((b) => Math.max(0, b - Math.ceil(leavesHere / POUR_STEPS))),
      basket === leavesHere ? POUR_START_MS : POUR_STEP_MS,
    );
    return () => clearTimeout(id);
  }, [done, basket]);
  /** What can be spent: the basket is not poured yet. */
  const reserve = leaves - basket;

  const later = (ms: number, action: () => void) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(action, ms);
  };

  /** The next question of the trail; now and then on a challenge notion, a flash bonus. */
  const ask = () => {
    const question = session.ask(exercise);
    const chance =
      !flashUsed.current &&
      question.exercise.input.kind === 'keypad' &&
      challenges.some((s) => s.id === question.skill.id) &&
      rng.chance(FLASH_SHARE);
    show(question);
    if (chance) flashUsed.current = true;
    setFlash(chance);
  };

  const show = (question: { skill: Skill; exercise: Exercise }) => {
    setQuestion(question);
    setMistakes(0);
    setRound((r) => r + 1);
    setPhase('asking');
    setFlash(false);
    shownAt.current = playClock();
    firstAnswerMs.current = null;
  };

  const proceed = () => {
    if (drilling) {
      nextDrill();
      return;
    }
    if (mode === 'challenge') {
      nextChallenge();
      return;
    }
    if (session.advance()) {
      ask();
      return;
    }
    logPlay('trail');
    setEnded('trail');
    setFinished(true);
    setDone(true);
    setPhase('walking');
  };

  /** A touch on the trail: its first question is already drawn, a new trail draws its own. */
  const start = () => {
    if (!free) return;
    squirrelWaits.current = false;
    if (!finished) {
      setPhase('asking');
      shownAt.current = playClock();
      return;
    }
    session.startTrail();
    tally.current = { questions: 0, right: 0, ms: 0 };
    setFinished(false);
    setLeavesHere(0);
    setSeedsHere(0);
    setBasket(0);
    flashUsed.current = false;
    ask();
  };

  /** The notions the parent did not close (#47). */
  const playable = props.skills.filter((s) => modeOf(session.settings, s) !== 'closed');
  /** The trees of the drill: the notions met with groups of facts, the most branches first. */
  const trees = playable
    .filter(
      (s) => s.facts?.groups && (session.progress.get(s.id)?.stage ?? 'discovery') !== 'discovery',
    )
    .sort((a, b) => b.facts!.groups!.length - a.facts!.groups!.length);

  const startDrill = (target: DrillTarget) => {
    if (phase !== 'drill-menu') return;
    squirrelWaits.current = false;
    drill.current = new Drill(session, target, new Rng(rng.int(0, 2 ** 31)));
    tally.current = { questions: 0, right: 0, ms: 0 };
    drillStart.current = playClock();
    pauseOffered.current = false;
    setDrillArt(forest.trailArt(DRILL_ROUND));
    setMode('drill');
    setGarland(0);
    setLeavesHere(0);
    setSeedsHere(0);
    setBasket(0);
    show(drill.current.ask());
  };

  /** After each round, another one or the end; once, after a while, Plume offers a pause. */
  const nextDrill = () => {
    const current = drill.current!;
    if (current.asked % DRILL_ROUND === 0) {
      setPause(false);
      setPhase('break');
      return;
    }
    if (!pauseOffered.current && playClock() - drillStart.current >= DRILL_PAUSE_MS) {
      pauseOffered.current = true;
      setPause(true);
      setPhase('break');
      return;
    }
    show(current.ask());
  };

  const stopDrill = () => {
    if (phase !== 'break') return;
    drill.current = null;
    leave('drill');
  };

  /** The parent changed the notions: a trail not begun yet is drawn again with them. */
  const changeSettings = (settings: Map<SkillId, SkillSetting>) => {
    session.settings = settings;
    if (walking && !finished && session.index === 0 && tally.current.questions === 0) {
      session.startTrail();
      setQuestion(session.ask());
    }
    props.save(saveData());
  };

  /** Back to the walk after a drill or a challenge: the basket pours into the reserve. */
  const leave = (from: Mode) => {
    logPlay(from);
    setMode('trail');
    // The trail waiting keeps a question of its own.
    if (!finished) setQuestion(session.ask());
    setEnded(from);
    setDone(true);
    setPhase('walking');
  };

  /** Another round after the end of one; after the pause offered, the round goes on. */
  const moreDrill = () => {
    if (phase !== 'break') return;
    if (!pause) setGarland(0);
    show(drill.current!.ask());
  };

  /** The acquired notions with a challenge: the sign waits for the first one. */
  const challenges = challengeable(playable, session.progress);
  const offerList = offers(challenges, session.longChallenges);
  const offer = offerList.length > 0 ? offerList[offerAt % offerList.length] : null;

  /** After a trail ended on right answers, once per session, the squirrel offers a challenge. */
  const afterTrail = () => {
    if (offered.current || challenges.length === 0 || !squirrelComes(session.results)) return;
    // Something to buy: the purchase comes first, the squirrel once the shop is closed (#134).
    if (items.some((item) => canBuy(item, leaves, seeds))) squirrelWaits.current = true;
    else offerChallenge();
  };

  const offerChallenge = () => {
    squirrelWaits.current = false;
    offered.current = true;
    setPhase('squirrel');
  };

  const closeShop = () => {
    if (phase !== 'shop') return;
    if (squirrelWaits.current) offerChallenge();
    else setPhase('walking');
  };

  const startChallenge = (skill: Skill, format: ChallengeFormat) => {
    const level = challengeLevel(
      session.progress.get(skill.id)?.level ?? 0,
      session.attempts(skill.id, format),
    );
    const rngOf = new Rng(rng.int(0, 2 ** 31));
    squirrelWaits.current = false;
    challenge.current = new Challenge(session, skill, format, level, rngOf, playClock);
    challengeEnded.current = false;
    if (mode !== 'challenge') {
      tally.current = { questions: 0, right: 0, ms: 0 };
      setLeavesHere(0);
      setSeedsHere(0);
      setBasket(0);
    }
    setMode('challenge');
    setChallengeEnd(null);
    nextChallenge();
  };

  const nextChallenge = () => {
    const current = challenge.current!;
    if (current.over) {
      finishChallenge();
      return;
    }
    current.resume();
    show({ skill: current.skill, exercise: current.ask() });
  };

  /** The basket is full of what it got: always good news, a golden seed for trying. */
  const finishChallenge = () => {
    if (challengeEnded.current) return;
    challengeEnded.current = true;
    const current = challenge.current!;
    current.pause();
    clearTimeout(timer.current);
    const {
      skill: { id },
      format,
    } = current;
    const before = session.attempts(id, format);
    const attempt = current.attempt(today());
    const gift = firstOfDay(session.records.values(), attempt.day);
    const acorns = current.results.filter(Boolean).length;
    session.addAttempt(id, format, attempt);
    setChallengeEnd({
      format,
      attempt,
      ending: ending(format, before, attempt),
      acorns,
      gift,
    });
    if (gift) {
      const won = acorns * LEAVES_PER_ACORN;
      setLeaves((l) => l + won);
      setLeavesHere((h) => h + won);
      setBasket((b) => b + won);
      setSeeds((s) => s + SEEDS_PER_CHALLENGE);
      setSeedsHere((s) => s + SEEDS_PER_CHALLENGE);
      forest.reward('seed');
    }
    setPhase('challenge-end');
  };

  /** One touch in the shop: an element waits for its place, an animal, a season or the night comes at once. */
  const buy = (item: ShopItem) => {
    if (phase !== 'shop' || !canBuy(item, leaves, seeds)) return;
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
    if (article.kind === 'season' || article.kind === 'night') {
      const choice = article.kind === 'night' ? 'night' : article.season;
      setArrival(`${SEASON_LABELS[choice]} arrive !`);
      turn(choice);
      return;
    }
    if (article.kind === 'rare') {
      setArrival(RARE_ARRIVALS[article.rare]);
      setPhase('adopting');
      void forest.addRare(article.rare).then(() => {
        setArrival(null);
        setPhase('shop');
      });
      return;
    }
    setArrival(`${ANIMAL_LABELS[article.animal]} arrive !`);
    setPhase('adopting');
    void forest.adopt(article.animal).then(() => {
      setArrival(null);
      setPhase('shop');
    });
  };

  /** The painting passes to another of its seasons or the night, then back to where it was. */
  const turn = (choice: SeasonChoice) => {
    const back = phase;
    setTurnFrom(back);
    setPhase('turning');
    void forest.changeSeason(choice).then(() => {
      setArrival(null);
      setPhase(back);
    });
  };

  const plant = (slot: number) => {
    if (phase !== 'choosing') return;
    setSpots([]);
    setLeaves(leaves - leavesPerElement(forest.description().stage));
    setPhase('planting');
    void forest.plant(slot, today()).then(() => {
      setGrown((g) => g + 1);
      if (isComplete(forest.description())) finish();
      else setPhase('shop');
    });
  };

  /** The painting is complete: the grand finale, then its frame, and it joins the Album. */
  const finish = () => {
    setPhase('finale');
    void forest.finale().then(frame);
  };

  const frame = () => {
    const description = forest.description();
    let entries = album;
    if (!isFramed(album, description)) {
      const picture = forest.picture();
      entries = [...album, { description, ...journal, finished: today(), picture }];
      setAlbum(entries);
      props.saveAlbum(entries);
    }
    setPhase('framing');
    later(FRAMED_MS, () => chooseNext(entries));
  };

  /** Under the light, the décors of the next painting, each shown as it will be once complete. */
  const chooseNext = (entries: readonly AlbumEntry[]) => {
    const painted = entries.map((entry) => entry.description.biome);
    const options = nextBiomes(QUESTS, isoDate(today()), painted).map((biome) =>
      newPainting(rng.int(0, 999_999), DEFAULT_DESCRIPTION.season, biome),
    );
    forest.cover(true);
    setPhase('next');
    setChoices(options.map((description) => ({ description, picture: null })));
    later(COVER_MS, () => {
      // The décor of the quest: no choice, the painting starts at once.
      if (options.length === 1) {
        startPainting(options[0]);
        return;
      }
      setChoices(
        options.map((description) => {
          forest.show(completed(description));
          return { description, picture: forest.picture() };
        }),
      );
    });
  };

  const startPainting = (description: SceneDescription) => {
    forest.start(description);
    setJournal({ started: today(), acquired: [], automated: [] });
    setChoices([]);
    forest.cover(false);
    setPhase('walking');
  };

  const openAlbum = () => {
    if (!free) return;
    forest.cover(true);
    setPhase('album');
  };

  /** A painting of the Album, alive again: built under the light, which then goes. */
  const visit = (entry: AlbumEntry) => {
    if (phase !== 'album') return;
    forest.show(entry.description);
    forest.cover(false);
    setPage(entry);
    setPhase('visiting');
  };

  const backToAlbum = () => {
    if (phase !== 'visiting') return;
    forest.cover(true);
    setPhase('album');
  };

  const closeAlbum = () => {
    if (phase !== 'album') return;
    forest.show(null);
    forest.cover(false);
    setPage(null);
    setPhase('walking');
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
    firstAnswerMs.current ??= Math.max(0, playClock() - shownAt.current);
    if (drilling) {
      answerDrill(value, firstAnswerMs.current);
      return;
    }
    if (mode === 'challenge') {
      answerChallenge(value, firstAnswerMs.current);
      return;
    }
    if (!skill.validate(exercise, value)) {
      setMistakes(mistakes + 1);
      if (mistakes + 1 >= 2) {
        count(false);
        session.conclude(skill, exercise, false, firstAnswerMs.current, true);
        setPhase('reveal');
      }
      return;
    }
    count(mistakes === 0);
    const achievements = session.conclude(
      skill,
      exercise,
      mistakes === 0,
      firstAnswerMs.current,
      false,
    );
    const flashWon = flash && mistakes === 0 && firstAnswerMs.current <= FLASH_MS;
    reward(achievements, PRAISE_MS, flashWon ? LEAVES_PER_FLASH : 0);
  };

  /** One try in a drill: a missed answer shows a moment, then the next question comes. */
  const answerDrill = (value: string, ms: number) => {
    const right = skill.validate(exercise, value);
    count(right);
    const achievements = drill.current!.conclude(skill, exercise, right, ms);
    if (right) {
      setGarland((g) => g + 1);
      reward(achievements, DRILL_RIGHT_MS);
      return;
    }
    note(achievements);
    setPhase('reveal');
    later(DRILL_REVEAL_MS, proceed);
  };

  /** One try in a challenge, the clock stopped until the next question: a mistake costs no time. */
  const answerChallenge = (value: string, ms: number) => {
    const current = challenge.current!;
    current.pause();
    const right = skill.validate(exercise, value);
    count(right);
    const achievements = current.conclude(exercise, right, ms);
    if (right) {
      reward(achievements, CHALLENGE_RIGHT_MS);
      return;
    }
    note(achievements);
    setPhase('reveal');
    later(DRILL_REVEAL_MS, proceed);
  };

  /** What an answer taught goes in the journal of the painting. */
  const note = (achievements: readonly Achievement[]) => {
    if (achievements.length === 0) return;
    setJournal((j) => ({
      ...j,
      acquired: [
        ...j.acquired,
        ...achievements.flatMap((a) => (a.kind === 'acquired' ? [a.skill] : [])),
      ],
      automated: [
        ...j.automated,
        ...achievements.flatMap((a) => (a.kind === 'automated' ? [a.fact] : [])),
      ],
    }));
  };

  /** A right answer: praise and a leaf (and a flash bonus), golden seeds for what it taught. */
  const reward = (achievements: readonly Achievement[], praiseMs: number, bonus = 0) => {
    note(achievements);
    setPraise(bonus > 0 ? 'Éclair !' : rng.pick(PRAISES));
    setPhase('right');
    forest.reward('right');
    // In a challenge, an acorn in the squirrel's basket instead: leaves come at its end (#120).
    const worth = drilling ? drill.current!.earned : session.worth;
    const earned = mode === 'challenge' ? 0 : worth + bonus;
    setLeaves(leaves + earned);
    setLeavesHere(leavesHere + earned);
    setBasket(basket + earned);
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
    later(praiseMs, () => play(steps));
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
  const seasonChoices = choicesOf(forest.description());
  const items = shopItems(forest.description());
  // Between two trails, the next one waits with its sign, a touch on it starts it; it stays
  // while the season turns, out of sight in the shop, the finale and the Album.
  const waiting = shown === 'walking' && !done;
  // Away from the framing, the landscape alone: the trail comes back with it.
  const exploring = waiting && viewAway;
  // During a drill or a challenge, the trail has nothing to show: out of sight.
  const aside = (!waiting && !onTrail && !done) || exploring || mode !== 'trail';
  let trailStone = finished ? session.stones : session.stone;
  if (waiting) trailStone = 0;
  else if (drilling && drill.current) trailStone = roundCrossed(drill.current);
  /** The branch of the drill, between two rounds, with today's leaves. */
  const roundBranch = ({ target }: Drill) => {
    if (target.kind !== 'skill') return null;
    const groups = trees.find((s) => s.id === target.skill)?.facts?.groups;
    const group = groups?.find((g) => g.id === target.group);
    return group ? { group, facts: session.facts, today: today() } : null;
  };
  let over: ComponentChildren = null;
  /** During a basket, the squirrel's acorns stand by the slate instead of Plume's leaves. */
  let acornCount: number | undefined;
  if (drilling) over = <Garland leaves={garland} />;
  else if (flash && mode === 'trail') over = <FlashBadge />;
  else if (mode === 'challenge' && challenge.current) {
    const current = challenge.current;
    const { format, results } = current;
    const right = results.filter(Boolean).length;
    if (format.kind === 'basket') {
      const total = format.seconds * 1000;
      over = <ChallengeBar time={1 - current.remaining() / total} />;
      acornCount = right;
    } else {
      const best = bestOf(format, session.attempts(current.skill.id, format));
      over = (
        <RaceBar
          stones={format.questions}
          leaf={right / format.questions}
          ghost={best && Math.min(1, current.elapsed() / best.score)}
        />
      );
    }
  }
  // A golden seed: the slate steps aside, the forest lights up.
  const away = phase === 'seed';
  let mood: Mood = 'calm';
  if (phase === 'right' || away) mood = 'cheer';
  else if (hint) mood = 'talk';
  /** The painting just framed, the last one of the Album. */
  const framed = phase === 'framing' || phase === 'next' ? album.at(-1) : undefined;
  return (
    <>
      <Reserve
        leaves={reserve}
        seeds={seeds}
        // A button between two trails, pressed while the shop is open; it glows when something
        // is within reach.
        button={waiting || SHOP_PHASES.has(shown)}
        open={SHOP_PHASES.has(shown)}
        ready={free && items.some((item) => canBuy(item, leaves, seeds))}
        onTap={() => {
          if (free) setPhase('shop');
          else closeShop();
        }}
        // The same finger opened the shop when it touched: the parent menu takes its place.
        onLongPress={() => {
          setMenu(true);
          setPhase((now) => (now === 'shop' ? 'walking' : now));
        }}
      />
      {/* Only when there is a choice: a single season is nothing to touch. */}
      {seasonChoices.length > 1 && (canTurn || phase === 'turning') && (
        <SeasonPicker
          choices={seasonChoices}
          shown={shownChoice(forest.description())}
          active={canTurn}
          onPick={(s) => {
            if (canTurn) turn(s);
          }}
        />
      )}
      <TrailPath
        art={drilling ? drillArt : art}
        stones={drilling ? DRILL_ROUND : session.stones}
        current={trailStone}
        name={drilling ? DRILL_NAME : undefined}
        onStart={waiting && !exploring ? start : undefined}
        aside={drilling ? !onTrail : aside}
      />
      {trees.length > 0 && (
        <TuftButton
          id="stump"
          sprite={art?.stump}
          name={DRILL_NAME}
          onOpen={free && !exploring ? () => setPhase('drill-menu') : undefined}
        />
      )}
      {challenges.length > 0 && (
        <TuftButton
          id="challenge-sign"
          sprite={art?.challenge}
          name={CHALLENGE_NAME}
          onOpen={free && !exploring ? () => setPhase('challenge-menu') : undefined}
        />
      )}
      {/* During a question, the forest dims: one thing at a time. */}
      <div id="dim" class={onTrail && !away ? 'on' : ''} />
      {gift && phase === 'seed' && <SeedGift {...gift} />}
      {phase === 'choosing' && <Spots forest={forest} slots={spots} onPick={plant} />}
      {roaming && !done && <Walk away={viewAway} onRecenter={() => forest.recenter()} />}
      {free && album.length > 0 && <AlbumButton onOpen={openAlbum} />}
      {phase === 'album' && <AlbumGrid entries={album} onVisit={visit} onClose={closeAlbum} />}
      {phase === 'visiting' && page && (
        <AlbumPage entry={page} skills={props.skills} onBack={backToAlbum} />
      )}
      {(phase === 'finale' || phase === 'framing') && (
        <FinaleBanner framed={phase === 'framing'} name={name} />
      )}
      {phase === 'naming' && (
        <Naming
          onDone={(given) => {
            setName(given);
            setGreeting(given !== '');
            setPhase('walking');
          }}
        />
      )}
      {greeting && free && !viewAway && (
        <section id="greeting" aria-live="polite">
          <p class="title">{named('Bonjour !', name)}</p>
        </section>
      )}
      {framed && (
        <Frame
          description={framed.description}
          started={framed.started}
          finished={framed.finished}
          away={phase === 'next'}
        />
      )}
      {phase === 'next' && (
        <NextPainting
          choices={choices}
          onPick={(description) => {
            if (phase === 'next' && choices.every((choice) => choice.picture)) {
              startPainting(description);
            }
          }}
        />
      )}
      {arrival && (
        <section id="arrival" aria-live="polite">
          <p class="title">{arrival}</p>
        </section>
      )}
      {menu && (
        <ParentMenu
          skills={props.skills}
          session={session}
          day={today()}
          length={length}
          recommended={recommended}
          name={name}
          onName={setName}
          problem={props.problem}
          exportSave={() => exportFile(saveData(), album)}
          quality={forest.quality}
          onQuality={(value) => forest.setQuality(value)}
          onLength={(value) => {
            session.length = value;
            setLength(value);
          }}
          onSettings={changeSettings}
          onAutomation={(factor) => {
            session.automation = factor;
            props.save(saveData());
          }}
          onLongChallenges={(open) => {
            session.longChallenges = open;
            props.save(saveData());
          }}
          onRecommended={setRecommended}
          onClose={() => setMenu(false)}
        />
      )}
      {FINALE_PHASES.has(phase) || browsing ? null : onTrail ? (
        <Slate
          away={away}
          heading={
            phase === 'right' ? (
              <p class="praise">{praise}</p>
            ) : (
              <p class="instruction">{exercise.instruction}</p>
            )
          }
          mood={mood}
          squirrel={mode === 'challenge'}
          acorns={acornCount}
          hint={hint}
          basket={basket}
          over={over}
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
      ) : (
        <>
          {done && (
            <TrailDone
              title={named(DONE_TITLES[ended], name)}
              leaves={leavesHere}
              seeds={seedsHere}
              basket={basket}
            />
          )}
          {(phase === 'squirrel' || phase === 'challenge-menu') && offer && (
            <ChallengeOffer
              id={phase === 'squirrel' ? 'squirrel' : 'challenge-offer'}
              title={phase === 'squirrel' ? 'Un écureuil passe !' : 'Un défi avec l’écureuil ?'}
              offer={offer}
              best={
                bestOf(offer.format, session.attempts(offer.skill.id, offer.format))?.score ?? null
              }
              more={offerList.length > 1}
              onAccept={() => {
                setOfferAt((at) => at + 1);
                startChallenge(offer.skill, offer.format);
              }}
              onAnother={() => setOfferAt((at) => at + 1)}
              onDecline={() => setPhase('walking')}
            />
          )}
          {phase === 'challenge-end' && challengeEnd && (
            <ChallengeEnd
              {...challengeEnd}
              name={name}
              basket={basket}
              onMore={() => {
                const { skill: s, format } = challenge.current!;
                startChallenge(s, format);
              }}
              onStop={() => {
                challenge.current = null;
                leave('challenge');
              }}
            />
          )}
          {phase === 'drill-menu' && (
            <DrillTree
              trees={trees}
              facts={session.facts}
              suggested={suggestedBranch(trees, session.facts, recommended)}
              onPick={startDrill}
              onClose={() => setPhase('walking')}
            />
          )}
          {phase === 'break' && drill.current && (
            <DrillBreak
              basket={basket}
              branch={roundBranch(drill.current)}
              pause={pause}
              onMore={moreDrill}
              onStop={stopDrill}
            />
          )}
          {SHOP_PHASES.has(shown) && (
            <section id="shop" class={`card${phase === 'shop' ? '' : ' away'}`}>
              <Shop
                items={items}
                leaves={leaves}
                seeds={seeds}
                portrait={(animal) => forest.portrait(animal)}
                onBuy={buy}
              />
              <div class="actions">
                <button type="button" onPointerDown={closeShop}>
                  Fermer
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** The stones of the round in progress crossed so far: the question asked, once answered. */
function roundCrossed(drill: Drill): number {
  const index = (drill.asked - 1) % DRILL_ROUND;
  return index + (drill.results.length === drill.asked ? 1 : 0);
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

interface WalkProps {
  /** The view has left the framing. */
  away: boolean;
  onRecenter(): void;
}

/** During a walk in the forest: the whole forest again once the view has left it. */
function Walk({ away, onRecenter }: WalkProps) {
  return (
    <section id="walk" aria-label="Promenade dans le paysage">
      {away && (
        <button type="button" class="whole" onPointerDown={onRecenter}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M4 11V5h6M22 5h6v6M28 21v6h-6M10 27H4v-6" />
            <path class="hill" d="M8 22l5-7 4 5 3-3 4 5z" />
          </svg>
          Revenir
        </button>
      )}
    </section>
  );
}

interface TrailDoneProps {
  /** « Sentier terminé ! », « Belle récolte ! » or « Défi terminé ! ». */
  title: string;
  /** Earned on this trail. */
  leaves: number;
  seeds: number;
  /** Leaves still in Plume's basket: she pours them into the reserve. */
  basket: number;
}

/** The end of a trail or a drill, a moment over the whole forest: what was done, never what was missed. */
function TrailDone({ title, leaves, seeds, basket }: TrailDoneProps) {
  let earned = '';
  if (leaves > 0 && seeds > 0) {
    earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')} et ${plural(seeds, 'graine dorée', 'graines dorées')}.`;
  } else if (leaves > 0) earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')}.`;
  else if (seeds > 0) earned = `Tu as gagné ${plural(seeds, 'graine dorée', 'graines dorées')}.`;
  return (
    <section id="trail-end" class="card" aria-live="polite">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={basket > 0} />
      <p class="praise">{title}</p>
      {earned && <p class="instruction earned">{earned}</p>}
    </section>
  );
}

/**
 * Mounts the game over the scene, which shows `forest`, the painting in progress. A save or an
 * Album that could not be read is never overwritten: the game is played without saving, and
 * the parent menu says why.
 */
export function mountGame(
  root: HTMLElement,
  skills: readonly Skill[],
  seed: number,
  forest: GameForest,
  saved: ParsedSave | null,
  album: ParsedAlbum,
  write: (json: string) => void,
  writeAlbum: (json: string) => void,
  home = true,
  debug?: GameDebug,
  /** `ask`: Plume asks the first name while there is none; `given` replaces the saved one. */
  naming: { ask: boolean; given: string | null } = { ask: false, given: null },
) {
  const rng = new Rng(seed);
  const session = new Session(skills, rng.fork('trail'), today, () => ({
    vocabulary: BIOMES[forest.description().biome].vocabulary,
  }));
  if (saved?.ok) {
    session.restore(saved.data);
    session.length = saved.data.trailLength;
  }
  session.startTrail();
  if (debug) {
    debug.progress = () => session.snapshot();
    debug.step = () => {
      const skill = skills.find((s) => s.id === session.step.skill)!;
      return {
        skill: skill.id,
        level: stepLevel(
          session.step,
          session.progress.get(skill.id),
          settingOf(session.settings, skill),
        ),
      };
    };
  }
  const name = cleanName(naming.given ?? (saved?.ok ? saved.data.name : ''));
  // Not on a save that could not be read: nothing would keep it.
  const askName = naming.ask && home && saved?.ok !== false && name === '';
  let phase: Phase = home ? 'walking' : 'asking';
  if (askName) phase = 'naming';
  const probe: GameProbe = {
    exercise: null,
    leaves: 0,
    seeds: 0,
    basket: 0,
    grown: 0,
    phase,
    drilling: false,
    mode: 'trail',
    flash: false,
    asked: 0,
    stone: 0,
    stones: session.stones,
    role: null,
    worth: 0,
  };
  let problem: string | null = null;
  if (saved && !saved.ok) {
    problem = `La sauvegarde n’a pas pu être lue : ${saved.reason} Elle est gardée intacte.`;
  } else if (!album.ok) {
    problem = `L’Album n’a pas pu être lu : ${album.reason} Il est gardé intact.`;
  }
  render(
    <Game
      session={session}
      skills={skills}
      rng={rng}
      leaves={saved?.ok ? saved.data.leaves : 0}
      seeds={saved?.ok ? saved.data.seeds : 0}
      recommended={saved?.ok ? saved.data.recommended : null}
      journal={saved?.ok ? saved.data.journal : { started: today(), acquired: [], automated: [] }}
      album={album.ok ? album.entries : []}
      problem={problem}
      forest={forest}
      save={problem ? () => undefined : write}
      saveAlbum={problem ? () => undefined : (entries) => writeAlbum(serializeAlbum(entries))}
      probe={probe}
      home={home}
      name={name}
      askName={askName}
      debug={debug}
    />,
    root,
  );
  return probe;
}
