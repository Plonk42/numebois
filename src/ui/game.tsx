import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isoDate, today } from '../core/day';
import {
  LEAVES_PER_ELEMENT,
  LEAVES_PER_RIGHT_ANSWER,
  SEEDS_PER_ACHIEVEMENT,
} from '../core/economy';
import { Rng } from '../core/rng';
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
import { serializeSave, type PaintingJournal, type ParsedSave } from '../save/save';
import type { AnimalName } from '../scene/animal-catalog';
import { BIOMES, nextBiomes } from '../scene/biomes';
import {
  completed,
  DEFAULT_DESCRIPTION,
  isComplete,
  newPainting,
  type SceneDescription,
} from '../scene/description';
import { canBuy, shopItems, type ShopItem } from '../scene/shop';
import type { Quality } from '../scene/render/quality';
import type { TrailArt } from '../scene/render/trail-art';
import type { Season } from '../scene/trees/builder';
import { AlbumButton, AlbumGrid, AlbumPage } from './album';
import { Basket } from './basket';
import { FinaleBanner, Frame, NextPainting, type NextChoice } from './finale';
import { ParentMenu } from './parent-menu';
import { Plume, type PlumeMood } from './plume';
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
/** Then « Sentier terminé ! » stays a moment before the forest is all the child's. */
const DONE_MS = 2000;
/** The finished painting stays framed a moment, then the light comes over it. */
const FRAMED_MS = 3500;
/** Time for the light to cover the scene before a painting is built under it (#veil). */
const COVER_MS = 750;
const PRAISES = ['Bravo !', 'Super !', 'Oui !', 'Bien vu !', 'Génial !'];

type Phase =
  | 'walking'
  | 'asking'
  | 'right'
  | 'reveal'
  | 'seed'
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

/** A trail in progress: the slate and its rewards. */
const TRAIL_PHASES = new Set<Phase>(['asking', 'right', 'reveal', 'seed']);
/** The shop, opened from the reserve between two trails, and what it brings to the painting. */
const SHOP_PHASES = new Set<Phase>(['shop', 'choosing', 'planting', 'adopting', 'turning']);
/** A complete painting: the grand finale, its frame, then the choice of the next one (#33). */
const FINALE_PHASES = new Set<Phase>(['finale', 'framing', 'next']);
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
  /** Shows the painting in another season (a bought one joins its seasons); resolves once shown. */
  changeSeason(season: Season): Promise<unknown>;
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
  stone: number;
  stones: number;
  role: StepRole | null;
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
  debug?: GameDebug;
}

/** Why golden seeds came: the first thing learnt. */
function giftReason(achievement: Achievement, skill: Skill): string {
  if (achievement.kind === 'automated') return 'Tu connais ce calcul par cœur.';
  return `Tu as appris : ${skill.name.charAt(0).toLowerCase()}${skill.name.slice(1)}.`;
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
    return props.home ? 'walking' : 'asking';
  });
  const [praise, setPraise] = useState(PRAISES[0]);
  const [menu, setMenu] = useState(false);
  const [length, setLength] = useState<TrailLength>(session.length);
  const [art, setArt] = useState<TrailArt | null>(null);
  const [spots, setSpots] = useState<readonly number[]>([]);
  const [arrival, setArrival] = useState<string | null>(null);
  /** The trail is over: the next one is drawn when the child starts it. */
  const [finished, setFinished] = useState(false);
  const [viewAway, setViewAway] = useState(false);
  /** The child has moved the view once: no need to say how any more. */
  const [moved, setMoved] = useState(false);
  /** « Sentier terminé ! » shows while Plume pours her basket, then goes. */
  const [done, setDone] = useState(false);
  const [journal, setJournal] = useState(props.journal);
  const [album, setAlbum] = useState(props.album);
  const [choices, setChoices] = useState<readonly NextChoice[]>([]);
  const [page, setPage] = useState<AlbumEntry | null>(null);
  /** Where a change of season started: the screen stays as it was under the light. */
  const [turnFrom, setTurnFrom] = useState<Phase>('walking');
  const timer = useRef(0);
  const shownAt = useRef(performance.now());
  const firstAnswerMs = useRef<number | null>(null);

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
      stone: finished ? session.stones : session.stone,
      stones: session.stones,
      role: finished ? null : session.step.role,
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
    const onAway = (away: boolean) => {
      setViewAway(away);
      if (away) setMoved(true);
    };
    forest.explore(roaming ? onAway : null);
    if (!roaming) setViewAway(false);
  }, [roaming]);
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
      },
      new Date(),
    );
  // Every answer changes the phase or the reserve, every element the phase: the save follows.
  useEffect(() => props.save(saveData()), [leaves, seeds, phase, length, journal]);
  // The end of the trail: the basket empties into the reserve, then the forest is the child's.
  useEffect(() => {
    if (!done) return;
    if (basket === 0) {
      const id = window.setTimeout(() => setDone(false), DONE_MS);
      return () => clearTimeout(id);
    }
    const id = window.setTimeout(
      () => setBasket((b) => b - 1),
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

  const ask = () => {
    setQuestion(session.ask(exercise));
    setMistakes(0);
    setRound((r) => r + 1);
    setPhase('asking');
    shownAt.current = performance.now();
    firstAnswerMs.current = null;
  };

  const proceed = () => {
    if (session.advance()) {
      ask();
      return;
    }
    setFinished(true);
    setDone(true);
    setPhase('walking');
  };

  /** A touch on the trail: its first question is already drawn, a new trail draws its own. */
  const start = () => {
    if (!free) return;
    if (!finished) {
      setPhase('asking');
      shownAt.current = performance.now();
      return;
    }
    session.startTrail();
    setFinished(false);
    setLeavesHere(0);
    setSeedsHere(0);
    setBasket(0);
    ask();
  };

  /** One touch in the shop: an element waits for its place, an animal or a season comes at once. */
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
    if (article.kind === 'season') {
      setArrival(`${SEASON_LABELS[article.season]} arrive !`);
      turn(article.season);
      return;
    }
    setArrival(`${ANIMAL_LABELS[article.animal]} arrive !`);
    setPhase('adopting');
    void forest.adopt(article.animal).then(() => {
      setArrival(null);
      setPhase('shop');
    });
  };

  /** The painting passes to another of its seasons, then back to where it was. */
  const turn = (season: Season) => {
    const back = phase;
    setTurnFrom(back);
    setPhase('turning');
    void forest.changeSeason(season).then(() => {
      setArrival(null);
      setPhase(back);
    });
  };

  const plant = (slot: number) => {
    if (phase !== 'choosing') return;
    setSpots([]);
    setLeaves(leaves - LEAVES_PER_ELEMENT);
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
    if (achievements.length > 0) {
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
    }
    setPraise(rng.pick(PRAISES));
    setPhase('right');
    forest.reward('right');
    setLeaves(leaves + LEAVES_PER_RIGHT_ANSWER);
    setLeavesHere(leavesHere + LEAVES_PER_RIGHT_ANSWER);
    setBasket(basket + LEAVES_PER_RIGHT_ANSWER);
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
  const { season, seasons } = forest.description();
  const items = shopItems(forest.description());
  // Between two trails, the next one waits with its sign, a touch on it starts it; it stays
  // while the season turns, out of sight in the shop, the finale and the Album.
  const waiting = shown === 'walking' && !done;
  // Away from the framing, the landscape alone: the trail comes back with it.
  const exploring = waiting && viewAway;
  const aside = (!waiting && !onTrail && !done) || exploring;
  // A golden seed: the slate steps aside, the forest lights up.
  const away = phase === 'seed';
  let plume: PlumeMood = 'calm';
  if (phase === 'right' || away) plume = 'cheer';
  else if (hint) plume = 'talk';
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
          else if (phase === 'shop') setPhase('walking');
        }}
        // The same finger opened the shop when it touched: the parent menu takes its place.
        onLongPress={() => {
          setMenu(true);
          setPhase((now) => (now === 'shop' ? 'walking' : now));
        }}
      />
      {/* Only when there is a choice: a single season is nothing to touch. */}
      {seasons.length > 1 && (canTurn || phase === 'turning') && (
        <SeasonPicker
          seasons={seasons}
          season={season}
          active={canTurn}
          onPick={(s) => {
            if (canTurn) turn(s);
          }}
        />
      )}
      <TrailPath
        art={art}
        stones={session.stones}
        current={waiting ? 0 : finished ? session.stones : session.stone}
        onStart={waiting && !exploring ? start : undefined}
        aside={aside}
      />
      {/* During a question, the forest dims: one thing at a time. */}
      <div id="dim" class={onTrail && !away ? 'on' : ''} />
      {gift && phase === 'seed' && <SeedGift {...gift} />}
      {phase === 'choosing' && <Spots forest={forest} slots={spots} onPick={plant} />}
      {roaming && !done && (
        <Walk away={viewAway} moved={moved} onRecenter={() => forest.recenter()} />
      )}
      {free && album.length > 0 && <AlbumButton onOpen={openAlbum} />}
      {phase === 'album' && <AlbumGrid entries={album} onVisit={visit} onClose={closeAlbum} />}
      {phase === 'visiting' && page && (
        <AlbumPage entry={page} skills={props.skills} onBack={backToAlbum} />
      )}
      {(phase === 'finale' || phase === 'framing') && <FinaleBanner framed={phase === 'framing'} />}
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
          length={length}
          problem={props.problem}
          exportSave={() => exportFile(saveData(), album)}
          quality={forest.quality}
          onQuality={(value) => forest.setQuality(value)}
          onLength={(value) => {
            session.length = value;
            setLength(value);
          }}
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
          plume={plume}
          hint={hint}
          basket={basket}
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
          {done && <TrailDone leaves={leavesHere} seeds={seedsHere} basket={basket} />}
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
                <button type="button" onPointerDown={() => setPhase('walking')}>
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
  /** The child has already moved the view. */
  moved: boolean;
  onRecenter(): void;
}

/**
 * During a walk in the forest: how to move until the child has moved, and the whole forest
 * again once the view has left it.
 */
function Walk({ away, moved, onRecenter }: WalkProps) {
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
      {!moved && (
        <p class="hint">
          Glisse un doigt pour te promener,
          <br />
          deux doigts pour t’approcher et tourner.
        </p>
      )}
    </section>
  );
}

interface TrailDoneProps {
  /** Earned on this trail. */
  leaves: number;
  seeds: number;
  /** Leaves still in Plume's basket: she pours them into the reserve. */
  basket: number;
}

/** The end of a trail, a moment over the whole forest: what was done, never what was missed. */
function TrailDone({ leaves, seeds, basket }: TrailDoneProps) {
  let earned = '';
  if (leaves > 0 && seeds > 0) {
    earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')} et ${plural(seeds, 'graine dorée', 'graines dorées')}.`;
  } else if (leaves > 0) earned = `Tu as gagné ${plural(leaves, 'feuille', 'feuilles')}.`;
  return (
    <section id="trail-end" class="card" aria-live="polite">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={basket > 0} />
      <p class="praise">Sentier terminé !</p>
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
    debug.step = () => ({
      skill: session.step.skill,
      level: stepLevel(session.step, session.progress.get(session.step.skill)),
    });
  }
  const probe: GameProbe = {
    exercise: null,
    leaves: 0,
    seeds: 0,
    basket: 0,
    grown: 0,
    phase: home ? 'walking' : 'asking',
    stone: 0,
    stones: session.stones,
    role: null,
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
      journal={saved?.ok ? saved.data.journal : { started: today(), acquired: [], automated: [] }}
      album={album.ok ? album.entries : []}
      problem={problem}
      forest={forest}
      save={problem ? () => undefined : write}
      saveAlbum={problem ? () => undefined : (entries) => writeAlbum(serializeAlbum(entries))}
      probe={probe}
      home={home}
      debug={debug}
    />,
    root,
  );
  return probe;
}
