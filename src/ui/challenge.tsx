import type { Offer } from '../core/challenge';
import { named } from '../core/name';
import type { Attempt, ChallengeFormat, Ending } from '../core/records';
import { Basket } from './basket';
import { Squirrel } from './character';
import { LeafIcon, plural, SeedIcon } from './reserve';

/** The name of the challenges, written on their sign. */
export const CHALLENGE_NAME = 'Défi';

const DURATIONS: Record<30 | 60 | 90, string> = {
  30: '30 secondes',
  60: '1 minute',
  90: '1 minute 30',
};

export const acorns = (n: number) => plural(n, 'gland', 'glands');

/** A time of the race, to the second: « 42 s », « 1 min 12 s ». */
export function duration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}\u00a0s`;
  const rest = seconds % 60;
  const minutes = `${Math.floor(seconds / 60)}\u00a0min`;
  return rest ? `${minutes} ${rest}\u00a0s` : minutes;
}

/** A score as the child reads it: acorns in the basket, the time of the race. */
export const scoreLabel = (format: ChallengeFormat, score: number) =>
  format.kind === 'basket' ? acorns(score) : duration(score);

/** How an offer is named: « Le panier de glands », « 30 secondes ». */
function formatLabel(format: ChallengeFormat): [string, string] {
  return format.kind === 'basket'
    ? ['Le panier de glands', DURATIONS[format.seconds]]
    : ['La course de la feuille', `${format.questions} questions`];
}

interface OfferProps {
  id: string;
  /** « Un défi avec l’écureuil ? » from the sign, « Un écureuil passe ! » after a trail. */
  title: string;
  offer: Offer;
  /** The best score of the notion in the format, null before the first time. */
  best: number | null;
  /** The squirrel's gift of the day is still to give: a golden acorn on the picture (#143). */
  gift: boolean;
  /** Another offer is there: « Un autre ». */
  more: boolean;
  onAccept(): void;
  onAnother(): void;
  onDecline(): void;
}

/**
 * The squirrel offers one challenge (#132): its picture, its notion and its record, then
 * « D’accord ! », « Un autre » or « Non merci »; refusing never costs anything.
 */
export function ChallengeOffer(props: OfferProps) {
  const { id, title, offer, best, gift, more, onAccept, onAnother, onDecline } = props;
  const { skill, format } = offer;
  const [name, length] = formatLabel(format);
  return (
    <section id={id} class="card offer" aria-live="polite">
      <Squirrel mood="talk" />
      <p class="praise">{title}</p>
      <div class="offer-body">
        {format.kind === 'basket' ? <BasketPicture /> : <RacePicture />}
        {gift && (
          <span class="gift">
            <AcornIcon />
          </span>
        )}
        <div class="what">
          <b>{name}</b>
          <span>{length}</span>
          <span>{skill.name}</span>
          {best !== null && (
            <span class="record">
              {format.kind === 'basket' ? (
                <svg viewBox="-44 -40 88 50" aria-hidden="true">
                  <AcornPile count={Math.min(best, 7)} scale={0.8} />
                </svg>
              ) : (
                <svg viewBox="-14 -14 28 24" aria-hidden="true">
                  <path class="ghost" d={LEAF_SHAPE} />
                </svg>
              )}
              Record : {scoreLabel(format, best)}
            </span>
          )}
        </div>
      </div>
      <div class="actions">
        <button type="button" class="next" onPointerDown={onAccept}>
          D’accord !
        </button>
        {more && (
          <button type="button" onPointerDown={onAnother}>
            Un autre
          </button>
        )}
        <button type="button" onPointerDown={onDecline}>
          Non merci
        </button>
      </div>
    </section>
  );
}

const LEAF_SHAPE = 'M-11 7C-11-5-3-12 11-12 11 0 3 7-11 7z';

/** An acorn drawn around its centre, about 22 units wide. */
function Acorn({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g class="acorn" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path class="nut" d="M-9 0h18c0 9-4.5 15-9 16.5C-4.5 15-9 9-9 0z" />
      <path class="cap" d="M-11 0c0-6 5-9 11-9s11 3 11 9z" />
      <path class="stem" d="M0-9v-4" />
    </g>
  );
}

/** A pile of acorns, rows getting shorter upwards, its base centred on 0. */
export function AcornPile({ count, scale = 1 }: { count: number; scale?: number }) {
  const acorns: { x: number; y: number }[] = [];
  for (let row = 0, left = count; left > 0; row++) {
    const inRow = Math.min(left, Math.max(1, 5 - row));
    for (let k = 0; k < inRow; k++) {
      acorns.push({ x: (k - (inRow - 1) / 2) * 22 * scale, y: -row * 17 * scale });
    }
    left -= inRow;
  }
  return (
    <>
      {acorns.map(({ x, y }, i) => (
        <Acorn key={i} x={x} y={y} scale={scale} />
      ))}
    </>
  );
}

/** The basket under the sun: the sun crosses the sky while the basket fills. */
function BasketPicture() {
  return (
    <svg class="picture" viewBox="0 0 250 150" aria-hidden="true">
      <path class="sky" d="M30 120 Q125 -10 220 120" />
      <g transform="translate(70 62)">
        <circle class="glow" r="26" />
        <circle class="sun" r="17" />
      </g>
      <g transform="translate(150 96)">
        <path class="wicker" d="M-40 0h80l-10 40h-60z" />
        <path class="handle" d="M-30 0c0-30 60-30 60 0" />
        <AcornPile count={6} scale={0.9} />
      </g>
    </svg>
  );
}

/** The race: the child's leaf ahead of the ghost leaf, towards the flag. */
function RacePicture() {
  return (
    <svg class="picture" viewBox="0 0 250 150" aria-hidden="true">
      <path class="track" d="M20 110 C80 60 170 130 230 70" />
      <g transform="translate(226 62)">
        <path class="pole" d="M0 0v-40" />
        <path class="flag" d="M0-40l26 8-26 8z" />
      </g>
      <path class="ghost" transform="translate(150 98) scale(2.4)" d={LEAF_SHAPE} />
      <path class="runner" transform="translate(96 92) scale(2.8)" d={LEAF_SHAPE} />
    </svg>
  );
}

export function AcornIcon() {
  return (
    <svg class="acorn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path class="nut" d="M6 11h12c0 6-3 10-6 11-3-1-6-5-6-11z" />
      <path class="cap" d="M4 11c0-4 4-6 8-6s8 2 8 6z" />
      <path class="stem" d="M12 5V2" />
    </svg>
  );
}

interface BarProps {
  /** Time gone, from 0 to 1. */
  time: number;
}

/**
 * The time of the basket as a big sun crossing the sky over the slate (#133), warmer towards
 * the end: no red, no number, no beep.
 */
export function ChallengeBar({ time }: BarProps) {
  const x = 40 + time * 720;
  const y = 94 - Math.sin(Math.PI * time) * 52;
  return (
    <div class="challenge-bar">
      <svg viewBox="0 0 800 116" aria-hidden="true">
        <defs>
          <linearGradient id="sky-band" x1="0" x2="1">
            <stop offset="0" stop-color="#d8efff" />
            <stop offset="0.7" stop-color="#fff1c9" />
            <stop offset="1" stop-color="#ffd9a8" />
          </linearGradient>
        </defs>
        <path class="sky" d="M6 112 Q400 -34 794 112z" />
        <path class="course" d="M40 98 Q400 -10 760 98" />
        <path
          class="hills"
          d="M6 112 q50-24 100 0 q55-26 110 0 M584 112 q55-26 110 0 q50-24 100 0"
        />
        <g class={time > 0.8 ? 'sun evening' : 'sun'} transform={`translate(${x} ${y})`}>
          <circle class="glow" r="34" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} class="ray" d="M0-28v-9" transform={`rotate(${a})`} />
          ))}
          <circle class="disc" r="21" />
        </g>
      </svg>
    </div>
  );
}

/** The squirrel's basket at its feet during a challenge: the only count, and it only goes up. */
export function AcornBasket({ count }: { count: number }) {
  return (
    <div class="acorn-basket" role="img" aria-label={acorns(count)}>
      <svg viewBox="-60 -70 120 110" aria-hidden="true">
        <path class="wicker" d="M-46 0h92l-12 38h-68z" />
        <path class="handle" d="M-36 0c0-34 72-34 72 0" />
        <AcornPile count={Math.min(count, 10)} />
      </svg>
      {count > 0 && <b key={count}>{count}</b>}
    </div>
  );
}

interface RaceProps {
  /** Stones of the path, a question each. */
  stones: number;
  /** The child's leaf: right answers over the questions of the race, from 0 to 1. */
  leaf: number;
  /** The ghost leaf replaying the best time, from 0 to 1; null before the first race. */
  ghost: number | null;
}

/**
 * The race over the slate (#133): a path of stones to the flag, the child's leaf in green and
 * the ghost leaf of the record in gold, both big enough to tell apart at a glance.
 */
export function RaceBar({ stones, leaf, ghost }: RaceProps) {
  const at = (t: number) => 40 + t * 700;
  return (
    <div class="challenge-bar race">
      <svg viewBox="0 0 800 116" aria-hidden="true">
        <path class="track" d="M24 80 H776" />
        {Array.from({ length: stones }, (_, k) => (
          <ellipse
            key={k}
            class={(k + 1) / stones <= leaf ? 'stone crossed' : 'stone'}
            cx={at((k + 1) / stones)}
            cy={80}
            rx={18}
            ry={8}
          />
        ))}
        <g transform="translate(762 76)">
          <path class="pole" d="M0 0v-56" />
          <path class="flag" d="M0-56l30 9-30 9z" />
        </g>
        {ghost !== null && (
          <path class="ghost" transform={`translate(${at(ghost)} 66) scale(2.6)`} d={LEAF_SHAPE} />
        )}
        <path class="runner" transform={`translate(${at(leaf)} 66) scale(3)`} d={LEAF_SHAPE} />
      </svg>
    </div>
  );
}

const ENDINGS: Record<ChallengeFormat['kind'], Record<Ending, string>> = {
  basket: {
    first: 'Ton premier panier !',
    record: 'Nouveau record !',
    goal: 'Plus que d’habitude !',
    better: 'Plus que la dernière fois !',
    played: 'Bravo pour ce défi !',
  },
  race: {
    first: 'Ta première course !',
    record: 'Nouveau record !',
    goal: 'Plus vite que d’habitude !',
    better: 'Plus vite que la dernière fois !',
    played: 'Bravo pour cette course !',
  },
};

interface EndProps {
  format: ChallengeFormat;
  attempt: Attempt;
  ending: Ending;
  /** The squirrel's acorns of the challenge. */
  acorns: number;
  /** The first challenge of the day: the squirrel exchanges its acorns and gives a golden seed. */
  gift: boolean;
  /** The child's first name, empty when not given. */
  name: string;
  /** Leaves of the challenge in Plume's basket. */
  basket: number;
  onMore(): void;
  onStop(): void;
}

/**
 * The end of a challenge (#133), always good news and short: the good news, the acorns in a
 * pile or the time of the race, and at the first challenge of the day what the squirrel gives
 * for its acorns (#120, #126).
 */
export function ChallengeEnd(props: EndProps) {
  const { format, attempt, ending, acorns: count, gift, name, basket, onMore, onStop } = props;
  return (
    <section id="challenge-end" class="card" aria-live="polite">
      <Squirrel mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      <p class="praise">{named(ENDINGS[format.kind][ending], name)}</p>
      <div class="score" role="img" aria-label={scoreLabel(format, attempt.score)}>
        {format.kind === 'basket' ? (
          <svg viewBox="-80 -86 160 104" aria-hidden="true">
            <AcornPile count={Math.min(attempt.score, 14)} scale={1.4} />
          </svg>
        ) : (
          <svg viewBox="-16 -16 32 26" aria-hidden="true">
            <path class="runner" d={LEAF_SHAPE} />
          </svg>
        )}
        <b>{format.kind === 'basket' ? attempt.score : duration(attempt.score)}</b>
      </div>
      {gift && (
        <p
          class="gift"
          role="img"
          aria-label={`${plural(count, 'feuille', 'feuilles')} et une graine dorée`}
        >
          {count > 0 && (
            <span>
              <LeafIcon /> +{count}
            </span>
          )}
          <span>
            <SeedIcon /> +1
          </span>
        </p>
      )}
      <div class="actions">
        <button type="button" class="next" onPointerDown={onMore}>
          Encore un défi
        </button>
        <button type="button" onPointerDown={onStop}>
          J’ai fini
        </button>
      </div>
    </section>
  );
}

/** A flash question: discreet, on the frame of the slate, no time shown. */
export function FlashBadge() {
  return (
    <div class="flash-badge" aria-label="Éclair">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
      </svg>
      Éclair
    </div>
  );
}
