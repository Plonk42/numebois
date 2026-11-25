import { useState } from 'preact/hooks';
import type { Branch, DrillTarget } from '../core/drill';
import type { FactProgress } from '../core/facts';
import type { FactGroup, FactId, Skill } from '../core/types';
import type { TrailArt } from '../scene/render/trail-art';
import { Basket } from './basket';
import { Plume } from './character';
import { FactBranch, FactTree } from './fact-tree';
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

interface TreeProps {
  /** The notions met with groups of facts: a tree each. */
  trees: readonly Skill[];
  facts: ReadonlyMap<FactId, FactProgress>;
  /** The branch Plume makes glow. */
  suggested: Branch | null;
  onPick(target: DrillTarget): void;
  onClose(): void;
}

/**
 * Where the drill starts (#130): the tree of what is known by heart, a touch on a branch and
 * its drill begins. Plume makes a branch glow; a tab per tree when there are several.
 */
export function DrillTree({ trees, facts, suggested, onPick, onClose }: TreeProps) {
  const [shown, setShown] = useState(
    trees.find((skill) => skill.id === suggested?.skill) ?? trees[0],
  );
  const glow = suggested?.skill === shown.id ? suggested.group : null;
  return (
    <section id="drill-tree" class="card" aria-label={DRILL_NAME}>
      <Plume mood="talk" />
      {trees.length > 1 ? (
        <div class="tabs">
          {trees.map((skill) => (
            <button
              key={skill.id}
              type="button"
              aria-pressed={skill === shown}
              onPointerDown={() => setShown(skill)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      ) : (
        <p class="praise">{shown.name}</p>
      )}
      <FactTree
        skill={shown}
        facts={facts}
        glow={glow}
        onPick={(group) => onPick({ kind: 'skill', skill: shown.id, group: group.id })}
      />
      <div class="foot">
        <p class="bubble">
          {glow ? 'Choisis une branche. Celle qui brille t’attend\u00a0!' : 'Choisis une branche.'}
        </p>
        <button type="button" onPointerDown={onClose}>
          Fermer
        </button>
      </div>
    </section>
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

interface BreakProps {
  /** Leaves of the drill in Plume's basket. */
  basket: number;
  /** The branch of the round, its leaves of today growing; none for a drill without one. */
  branch: { group: FactGroup; facts: ReadonlyMap<FactId, FactProgress>; today: number } | null;
  /** Plume offers a pause rather than another round. */
  pause: boolean;
  onMore(): void;
  onStop(): void;
}

/**
 * Between two rounds of the drill (#131): the branch just played, where today's leaves grow one
 * by one, then another round or the end, without a word; after a while, Plume offers a pause.
 */
export function DrillBreak({ basket, branch, pause, onMore, onStop }: BreakProps) {
  return (
    <section id="drill-break" class="card">
      <Plume mood="cheer" />
      <Basket leaves={basket} pouring={false} />
      {pause && <p class="instruction">Et si tu faisais une pause ?</p>}
      {branch && <FactBranch {...branch} />}
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
