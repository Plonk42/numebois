import type { Offer } from '../core/challenge';
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
  const { id, title, offer, best, more, onAccept, onAnother, onDecline } = props;
  const { skill, format } = offer;
  const [name, length] = formatLabel(format);
  return (
    <section id={id} class="card offer" aria-live="polite">
      <Squirrel mood="talk" />
      <p class="praise">{title}</p>
      <div class="offer-body">
        {format.kind === 'basket' ? <BasketPicture /> : <RacePicture />}
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
  acorns: number;
}

/**
 * The time of the basket as a sun crossing the sky over the slate, warmer towards the end:
 * no red, no number, no beep. The acorns only ever go up.
 */
export function ChallengeBar({ time, acorns: count }: BarProps) {
  const x = 30 + time * 540;
  const y = 44 - Math.sin(Math.PI * time) * 30;
  return (
    <div class="challenge-bar">
      <svg viewBox="0 0 600 56" aria-hidden="true">
        <path class="sky" d="M30 44Q300-16 570 44" />
        <g class={time > 0.8 ? 'sun evening' : 'sun'} transform={`translate(${x} ${y})`}>
          <circle class="glow" r="17" />
          <circle class="disc" r="11" />
        </g>
      </svg>
      <span class="acorns" aria-label={acorns(count)}>
        <AcornIcon />
        <b key={count}>{count}</b>
      </span>
    </div>
  );
}

interface RaceProps {
  /** The child's leaf: right answers over the questions of the race, from 0 to 1. */
  leaf: number;
  /** The ghost leaf replaying the best time, from 0 to 1; null before the first race. */
  ghost: number | null;
}

/** The race as two leaves along a path over the slate: the child's, and the ghost of the best. */
export function RaceBar({ leaf, ghost }: RaceProps) {
  const at = (t: number) => 30 + t * 540;
  return (
    <div class="challenge-bar race">
      <svg viewBox="0 0 600 56" aria-hidden="true">
        <path class="track" d="M30 30H570" />
        <circle class="finish" cx="570" cy="30" r="8" />
        {ghost !== null && (
          <g class="ghost" transform={`translate(${at(ghost)} 30)`}>
            <path d="M-11 7C-11-5-3-12 11-12 11 0 3 7-11 7z" />
          </g>
        )}
        <g class="runner" transform={`translate(${at(leaf)} 30)`}>
          <path d="M-13 8C-13-6-4-14 13-14 13 0 4 8-13 8z" />
        </g>
      </svg>
    </div>
  );
}

const ENDINGS: Record<ChallengeFormat['kind'], Record<Ending, string>> = {
  basket: {
    first: 'Ton premier panier !',
    record: 'Nouveau record !',
    goal: 'Objectif atteint !',
    better: 'Plus que la dernière fois !',
    played: 'Bravo pour ce défi !',
  },
  race: {
    first: 'Ta première course !',
    record: 'Nouveau record !',
    goal: 'Objectif atteint !',
    better: 'Plus vite que la dernière fois !',
    played: 'Bravo pour cette course !',
  },
};

interface EndProps {
  format: ChallengeFormat;
  attempt: Attempt;
  ending: Ending;
  /** What to aim at next time. */
  next: number;
  /** The squirrel's acorns of the challenge. */
  acorns: number;
  /** The first challenge of the day: the squirrel exchanges its acorns and gives a golden seed. */
  gift: boolean;
  /** Leaves of the challenge in Plume's basket. */
  basket: number;
  onMore(): void;
  onStop(): void;
}

/**
 * The end of a challenge, always good news: the score and the next goal; at the first challenge
 * of the day, the squirrel's acorns exchanged for leaves, and a golden seed (#120, #126).
 */
export function ChallengeEnd({
  format,
  attempt,
  ending,
  next,
  acorns: count,
  gift,
  basket,
  onMore,
  onStop,
}: EndProps) {
  return (
    <section id="challenge-end" class="card" aria-live="polite">
      <Squirrel mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      <p class="praise">{ENDINGS[format.kind][ending]}</p>
      {format.kind === 'basket' ? (
        <p class="instruction">
          <AcornIcon /> {acorns(attempt.score)} dans le panier de l’écureuil.
        </p>
      ) : (
        <p class="instruction">
          <LeafIcon /> {format.questions} questions en {duration(attempt.score)}.
        </p>
      )}
      {gift ? (
        <p class="instruction">
          {count > 0 && (
            <>
              <LeafIcon /> Il t’échange ses glands contre {plural(count, 'feuille', 'feuilles')}
              {' et '}
            </>
          )}
          <SeedIcon /> {count > 0 ? 't’offre' : 'Il t’offre'} une graine dorée !
        </p>
      ) : (
        <p class="legend">Demain, l’écureuil échangera de nouveau ses glands.</p>
      )}
      <p class="legend">La prochaine fois, vise {scoreLabel(format, next)}.</p>
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
