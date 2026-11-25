import { useState } from 'preact/hooks';
import type { Attempt, ChallengeFormat, Ending } from '../core/records';
import type { Skill } from '../core/types';
import { Basket } from './basket';
import { Squirrel } from './character';
import { LeafIcon, plural, SeedIcon } from './reserve';

/** The name of the challenges, written on their sign. */
export const CHALLENGE_NAME = 'Défi';

/** The baskets offered, in seconds, and the races, in questions. */
export const BASKET_SECONDS = [30, 60, 90] as const;
export const RACE_QUESTIONS = [10, 20] as const;
const DURATIONS: Record<(typeof BASKET_SECONDS)[number], string> = {
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

interface MenuProps {
  /** The notions acquired that have a challenge. */
  skills: readonly Skill[];
  /** The best score in a format, null before the first attempt. */
  best(skill: Skill, format: ChallengeFormat): number | null;
  onStart(skill: Skill, format: ChallengeFormat): void;
  onClose(): void;
}

/** Where a challenge starts, always refusable: the notion, then a basket or a race. */
export function ChallengeMenu({ skills, best, onStart, onClose }: MenuProps) {
  const [skill, setSkill] = useState<Skill | null>(skills.length === 1 ? skills[0] : null);
  let body;
  if (!skill) {
    body = (
      <>
        <p class="praise">Un défi ?</p>
        <div class="options skills">
          {skills.map((s) => (
            <button key={s.id} type="button" onPointerDown={() => setSkill(s)}>
              {s.name}
            </button>
          ))}
        </div>
      </>
    );
  } else {
    const entry = (format: ChallengeFormat, label: string) => {
      const record = best(skill, format);
      return (
        <button
          key={label}
          type="button"
          class="entry"
          onPointerDown={() => onStart(skill, format)}
        >
          {label}
          {record !== null && <span class="record">Record : {scoreLabel(format, record)}</span>}
        </button>
      );
    };
    body = (
      <>
        <p class="praise">{skill.name}</p>
        <p class="kind">
          <SunIcon /> Le panier de glands : remplis-le avant la fin du soleil.
        </p>
        <div class="options baskets">
          {BASKET_SECONDS.map((seconds) => entry({ kind: 'basket', seconds }, DURATIONS[seconds]))}
        </div>
        <p class="kind">
          <LeafIcon /> La course de la feuille : va plus vite que ta feuille fantôme.
        </p>
        <div class="options races">
          {RACE_QUESTIONS.map((questions) =>
            entry({ kind: 'race', questions }, `${questions} questions`),
          )}
        </div>
      </>
    );
  }
  return (
    <section id="challenge-menu" class="card">
      <Squirrel mood="calm" />
      {body}
      <div class="actions">
        {skill && skills.length > 1 && (
          <button type="button" onPointerDown={() => setSkill(null)}>
            Retour
          </button>
        )}
        <button type="button" onPointerDown={onClose}>
          Pas maintenant
        </button>
      </div>
    </section>
  );
}

function SunIcon() {
  return (
    <svg class="sun-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path class="rays" d="M24 3v7M24 38v7M3 24h7M38 24h7M9 9l5 5M34 34l5 5M9 39l5-5M34 14l5-5" />
      <circle class="disc" cx="24" cy="24" r="10" />
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

interface OfferProps {
  skill: Skill;
  onAccept(): void;
  onDecline(): void;
}

/** After a trail ended on right answers, once per session: a squirrel offers a challenge. */
export function SquirrelOffer({ skill, onAccept, onDecline }: OfferProps) {
  return (
    <section id="squirrel" class="card" aria-live="polite">
      <Squirrel mood="talk" />
      <p class="praise">Un écureuil passe !</p>
      <p class="instruction">{'Il te propose le panier de glands de 30\u00a0secondes.'}</p>
      <p class="legend">{skill.name}</p>
      <div class="actions">
        <button type="button" class="next" onPointerDown={onAccept}>
          D’accord !
        </button>
        <button type="button" onPointerDown={onDecline}>
          Non merci
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
