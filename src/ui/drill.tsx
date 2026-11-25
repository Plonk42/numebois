import { useState } from 'preact/hooks';
import type { DrillTarget } from '../core/drill';
import { AUTOMATED_DAYS, isAutomated, type FactProgress } from '../core/facts';
import { Rng } from '../core/rng';
import type { FactId, Skill } from '../core/types';
import type { TrailArt } from '../scene/render/trail-art';
import { Basket } from './basket';
import { Plume } from './character';
import { LeafIcon } from './reserve';

/** The name of the drill, written on its stump. */
export const DRILL_NAME = 'Rafale';

interface TuftProps {
  id: string;
  /** Drawn with the models of the forest; nothing shows while they load. */
  sprite: TrailArt['stump'] | undefined;
  /** Written on its plank. */
  name: string;
  /** Between two trails, a touch opens it; out of sight otherwise. */
  onOpen?: () => void;
}

/**
 * A way in on its tuft of grass, beside the trail and like its sign: the stump of the drill
 * at the bottom right, the sign of the challenges at the bottom left.
 */
export function TuftButton({ id, sprite, name, onOpen }: TuftProps) {
  if (!sprite) return null;
  return (
    <button
      type="button"
      id={id}
      class={`tuft ${onOpen ? 'open' : 'aside'}`}
      aria-label={name}
      style={{ width: `${sprite.width}px`, height: `${sprite.height}px` }}
      onPointerDown={onOpen}
    >
      <img src={sprite.url} alt="" draggable={false} />
      <span
        style={{
          left: `${sprite.label.x}px`,
          top: `${sprite.label.y}px`,
          width: `${sprite.label.width}px`,
          height: `${sprite.label.height}px`,
          lineHeight: `${sprite.label.height}px`,
        }}
      >
        {name}
      </span>
    </button>
  );
}

interface MenuProps {
  /** The notions the child has met that can be drilled, in the order of the curriculum. */
  skills: readonly Skill[];
  /** « Mes faits fragiles » has something to offer. */
  fragile: boolean;
  /** The drill the parent recommends, first (#47). */
  recommended: { name: string; target: DrillTarget } | null;
  onPick(target: DrillTarget): void;
  onClose(): void;
}

/**
 * Where the drill starts: big entries (the parent's recommendation first), then the notion,
 * then its group of facts when it has some (« La table de 7 »).
 */
export function DrillMenu({ skills, fragile, recommended, onPick, onClose }: MenuProps) {
  const [choosing, setChoosing] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const pick = (chosen: Skill) => {
    if (chosen.facts?.groups) setSkill(chosen);
    else onPick({ kind: 'skill', skill: chosen.id });
  };
  let title = 'Une rafale !';
  let body;
  if (skill) {
    title = 'Lesquels ?';
    body = (
      <div class="options groups">
        <button type="button" onPointerDown={() => onPick({ kind: 'skill', skill: skill.id })}>
          Tout
        </button>
        {skill.facts!.groups!.map((group) => (
          <button
            key={group.id}
            type="button"
            onPointerDown={() => onPick({ kind: 'skill', skill: skill.id, group: group.id })}
          >
            {group.name}
          </button>
        ))}
      </div>
    );
  } else if (choosing) {
    title = 'Que veux-tu travailler ?';
    body = (
      <div class="options skills">
        {skills.map((s) => (
          <button key={s.id} type="button" onPointerDown={() => pick(s)}>
            {s.name}
          </button>
        ))}
      </div>
    );
  } else {
    body = (
      <div class="options entries">
        {recommended && (
          <button
            type="button"
            class="entry recommended"
            onPointerDown={() => onPick(recommended.target)}
          >
            <span class="ribbon">Recommandé</span>
            {recommended.name}
          </button>
        )}
        <button type="button" class="entry" onPointerDown={() => setChoosing(true)}>
          <ChooseIcon />
          Je choisis
        </button>
        {fragile && (
          <button type="button" class="entry" onPointerDown={() => onPick({ kind: 'fragile' })}>
            <FragileIcon />
            Mes faits fragiles
          </button>
        )}
      </div>
    );
  }
  const back = () => {
    if (skill) setSkill(null);
    else setChoosing(false);
  };
  return (
    <section id="drill-menu" class="card">
      <Plume mood="calm" />
      <p class="praise">{title}</p>
      {body}
      <div class="actions">
        {(choosing || skill) && (
          <button type="button" onPointerDown={back}>
            Retour
          </button>
        )}
        <button type="button" onPointerDown={onClose}>
          Fermer
        </button>
      </div>
    </section>
  );
}

function ChooseIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle class="disc" cx="24" cy="24" r="20" />
      <path class="mark" d="M15 25l6 6 12-14" />
    </svg>
  );
}

function FragileIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path class="soil" d="M8 40h32" />
      <path class="stem" d="M24 40V22" />
      <path class="leaf" d="M24 28c-8 1-13-4-14-12 8-1 13 4 14 12z" />
      <path class="leaf" d="M24 22c1-8 6-13 14-13 0 8-5 13-14 13z" />
    </svg>
  );
}

/** Leaves on the garland at most: a round of right answers fills it. */
export const GARLAND_LEAVES = 20;

/** A garland of leaves over the slate, a leaf per right answer of the round: it never loses one. */
export function Garland({ leaves }: { leaves: number }) {
  const shown = Math.min(leaves, GARLAND_LEAVES);
  return (
    <div class="garland" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} class={i % 2 ? 'leaf down' : 'leaf'}>
          <LeafIcon />
        </span>
      ))}
    </div>
  );
}

interface RoundProps {
  /** Questions of the round, answered or not. */
  of: number;
  /** Answered so far in the round. */
  crossed: number;
}

/** The end of the round always in sight, at the bottom: a pebble per question. */
export function RoundPebbles({ of, crossed }: RoundProps) {
  return (
    <div id="drill-round" role="img" aria-label={`Question ${Math.min(crossed + 1, of)} sur ${of}`}>
      {Array.from({ length: of }, (_, i) => {
        let state = 'ahead';
        if (i < crossed) state = 'crossed';
        else if (i === crossed) state = 'here';
        return <span key={i} class={`pebble ${state}`} />;
      })}
    </div>
  );
}

/** A fact met in the round, and how far it is from being known by heart. */
export interface RoundFact {
  fact: FactId;
  /** How it is written: « 7 × 8 », « Le double de 6 ». */
  label: string;
  /** Days it came at once, up to `AUTOMATED_DAYS`. */
  days: number;
  automated: boolean;
}

/** The facts met in a round, in the order of their notions. */
export function roundFacts(
  met: ReadonlyMap<FactId, Skill>,
  progress: ReadonlyMap<FactId, FactProgress>,
): RoundFact[] {
  return [...met]
    .sort(
      ([a, sa], [b, sb]) =>
        sa.id.localeCompare(sb.id) || sa.facts!.all.indexOf(a) - sb.facts!.all.indexOf(b),
    )
    .map(([fact, skill]) => ({
      fact,
      label: skill.facts!.exercise(fact, new Rng(0)).statement,
      days: Math.min(progress.get(fact)?.fastDays.length ?? 0, AUTOMATED_DAYS),
      automated: isAutomated(progress.get(fact)),
    }));
}

interface BreakProps {
  /** Questions of the drill so far. */
  asked: number;
  /** Leaves of the drill in Plume's basket. */
  basket: number;
  /** The facts of the round and their way to « by heart ». */
  facts: readonly RoundFact[];
  /** Plume offers a pause rather than another round. */
  pause: boolean;
  onMore(): void;
  onStop(): void;
}

/**
 * Between two rounds of the drill: the facts met and their leaves (one per day it came at
 * once, three: known by heart), then another round or the end; after a while, Plume offers a
 * pause.
 */
export function DrillBreak({ asked, basket, facts, pause, onMore, onStop }: BreakProps) {
  return (
    <section id="drill-break" class="card">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      <p class="praise">{pause ? 'Tu as bien travaillé !' : `${asked} questions !`}</p>
      {facts.length > 0 && (
        <>
          <ul class="facts">
            {facts.map(({ fact, label, days, automated }) => (
              <li key={fact} class={automated ? 'fact known' : 'fact'}>
                <span class="label">{label}</span>
                <span class="days" aria-label={`${days} sur ${AUTOMATED_DAYS}`}>
                  {Array.from({ length: AUTOMATED_DAYS }, (_, i) => (
                    <span key={i} class={i < days ? 'day on' : 'day'}>
                      <LeafIcon />
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p class="legend">Une feuille par jour où tu le trouves tout de suite.</p>
          <p class="legend">Trois feuilles : tu le sais par cœur !</p>
        </>
      )}
      <p class="instruction">{pause ? 'Et si tu faisais une pause ?' : 'Tu en veux encore ?'}</p>
      <div class="actions">
        <button type="button" class="next" onPointerDown={onMore}>
          {pause ? 'Je continue' : 'Encore !'}
        </button>
        <button type="button" onPointerDown={onStop}>
          {pause ? 'Une pause' : 'J’ai fini'}
        </button>
      </div>
    </section>
  );
}
