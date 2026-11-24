import { useState } from 'preact/hooks';
import type { Attempt, ChallengeFormat, Ending } from '../core/records';
import type { Skill } from '../core/types';
import { Basket } from './basket';
import { Plume } from './plume';
import { plural, SeedIcon } from './reserve';

/** The name of the challenges, written on their sign. */
export const CHALLENGE_NAME = 'Défi';

/** The baskets offered, in seconds. */
export const BASKET_SECONDS = [30, 60, 90] as const;
const DURATIONS: Record<(typeof BASKET_SECONDS)[number], string> = {
  30: '30 secondes',
  60: '1 minute',
  90: '1 minute 30',
};

export const acorns = (n: number) => plural(n, 'gland', 'glands');

interface MenuProps {
  /** The notions acquired that have a challenge. */
  skills: readonly Skill[];
  /** The best score in a format, null before the first attempt. */
  best(skill: Skill, format: ChallengeFormat): number | null;
  onStart(skill: Skill, format: ChallengeFormat): void;
  onClose(): void;
}

/** Where a challenge starts, always refusable: the notion, then the size of the basket. */
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
    body = (
      <>
        <p class="praise">Le panier de glands</p>
        <p class="instruction">{skill.name}</p>
        <p class="instruction">Remplis le panier pendant que le soleil traverse le ciel.</p>
        <div class="options baskets">
          {BASKET_SECONDS.map((seconds) => {
            const format = { kind: 'basket', seconds } as const;
            const record = best(skill, format);
            return (
              <button
                key={seconds}
                type="button"
                class="entry"
                onPointerDown={() => onStart(skill, format)}
              >
                <SunIcon />
                {DURATIONS[seconds]}
                {record !== null && <span class="record">Record : {acorns(record)}</span>}
              </button>
            );
          })}
        </div>
      </>
    );
  }
  return (
    <section id="challenge-menu" class="card">
      <Plume mood="calm" />
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

const ENDINGS: Record<Ending, string> = {
  first: 'Ton premier panier !',
  record: 'Nouveau record !',
  goal: 'Objectif atteint !',
  better: 'Plus que la dernière fois !',
  played: 'Bravo pour ce défi !',
};

interface EndProps {
  attempt: Attempt;
  ending: Ending;
  /** What to aim at next time. */
  next: number;
  /** Leaves of the challenge in Plume's basket. */
  basket: number;
  onMore(): void;
  onStop(): void;
}

/** The end of a challenge, always good news: the acorns, a golden seed, the next goal. */
export function ChallengeEnd({ attempt, ending, next, basket, onMore, onStop }: EndProps) {
  return (
    <section id="challenge-end" class="card" aria-live="polite">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      <p class="praise">{ENDINGS[ending]}</p>
      <p class="instruction">
        <AcornIcon /> {acorns(attempt.score)} dans ton panier.
      </p>
      <p class="instruction">
        <SeedIcon /> Une graine dorée pour ton défi !
      </p>
      <p class="legend">La prochaine fois, vise {acorns(next)}.</p>
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
