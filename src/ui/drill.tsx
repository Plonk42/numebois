import { useState } from 'preact/hooks';
import type { Branch, DrillTarget } from '../core/drill';
import { AUTOMATED_DAYS, isAutomated, type FactProgress } from '../core/facts';
import { Rng } from '../core/rng';
import type { FactId, Skill } from '../core/types';
import type { TrailArt } from '../scene/render/trail-art';
import { Basket } from './basket';
import { Plume } from './character';
import { FactTree } from './fact-tree';
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
