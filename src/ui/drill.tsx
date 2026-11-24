import { useState } from 'preact/hooks';
import type { DrillTarget } from '../core/drill';
import type { Skill } from '../core/types';
import type { TrailArt } from '../scene/render/trail-art';
import { Basket } from './basket';
import { Plume } from './plume';
import { LeafIcon } from './reserve';

/** The name of the drill, written on its stump. */
export const DRILL_NAME = 'Rafale';

interface StumpProps {
  art: TrailArt | null;
  /** Between two trails, a touch opens the drill; out of sight otherwise. */
  onOpen?: () => void;
}

/** The stump of the drill, at the bottom right, beside the trail and like its sign. */
export function Stump({ art, onOpen }: StumpProps) {
  if (!art) return null;
  const { stump } = art;
  return (
    <button
      type="button"
      id="stump"
      class={onOpen ? 'open' : 'aside'}
      aria-label={DRILL_NAME}
      style={{ width: `${stump.width}px`, height: `${stump.height}px` }}
      onPointerDown={onOpen}
    >
      <img src={stump.url} alt="" draggable={false} />
      <span
        style={{
          left: `${stump.label.x}px`,
          top: `${stump.label.y}px`,
          width: `${stump.label.width}px`,
          height: `${stump.label.height}px`,
          lineHeight: `${stump.label.height}px`,
        }}
      >
        {DRILL_NAME}
      </span>
    </button>
  );
}

interface MenuProps {
  /** The notions the child has met that can be drilled, in the order of the curriculum. */
  skills: readonly Skill[];
  /** « Mes faits fragiles » has something to offer. */
  fragile: boolean;
  onPick(target: DrillTarget): void;
  onClose(): void;
}

/**
 * Where the drill starts: big entries, then the notion, then its group of facts when it has
 * some (« La table de 7 »).
 */
export function DrillMenu({ skills, fragile, onPick, onClose }: MenuProps) {
  const [choosing, setChoosing] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const pick = (chosen: Skill) => {
    if (chosen.facts?.groups) setSkill(chosen);
    else onPick({ kind: 'skill', skill: chosen.id });
  };
  let title = 'Une rafale de calculs !';
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

/** Leaves on the garland at most: it stays full beyond. */
export const GARLAND_LEAVES = 20;

/**
 * A garland of leaves over the slate, a leaf per right answer in a row. After a mistake, it
 * starts again quietly.
 */
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

interface BreakProps {
  /** Questions of the drill so far. */
  asked: number;
  /** Leaves of the drill in Plume's basket. */
  basket: number;
  /** Plume offers a pause rather than another round. */
  pause: boolean;
  onMore(): void;
  onStop(): void;
}

/** Between two rounds of the drill: another one, or the end; after a while, Plume offers a pause. */
export function DrillBreak({ asked, basket, pause, onMore, onStop }: BreakProps) {
  return (
    <section id="drill-break" class="card">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      <p class="praise">{pause ? 'Tu as bien travaillé !' : `${asked} calculs !`}</p>
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
