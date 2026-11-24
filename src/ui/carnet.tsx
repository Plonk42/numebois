import { useState } from 'preact/hooks';
import { AUTOMATED_DAYS, isAutomated, type FactProgress } from '../core/facts';
import { Rng } from '../core/rng';
import type { FactGroup, FactId, Skill } from '../core/types';
import { plural } from './reserve';

/** The Carnet's notebook, under the sound button (and the Album's book once there is one). */
export function CarnetButton({ below, onOpen }: { below: boolean; onOpen(): void }) {
  return (
    <button
      id="carnet-button"
      class={below ? 'below' : ''}
      type="button"
      aria-label="Carnet"
      onPointerDown={onOpen}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect class="cover" x="7" y="4" width="19" height="24" rx="3" />
        <path class="rings" d="M7 9h-2M7 15h-2M7 21h-2" />
        <path class="leaf" d="M12 22c0-6 4-10 10-10 0 6-4 10-10 10z" />
        <path class="vein" d="M12 22l6-6" />
      </svg>
    </button>
  );
}

/** How far a fact is from « by heart »: 0 to `AUTOMATED_DAYS` leaves. */
function daysOf(progress: FactProgress | undefined): number {
  if (isAutomated(progress)) return AUTOMATED_DAYS;
  return Math.min(progress?.fastDays.length ?? 0, AUTOMATED_DAYS - 1);
}

/** A group in full bloom: all its facts known by heart. */
export function blooms(group: FactGroup, facts: ReadonlyMap<FactId, FactProgress>): boolean {
  return group.facts.every((fact) => isAutomated(facts.get(fact)));
}

interface Props {
  /** The notions with groups of facts the child has met: one tree each, the tables first. */
  skills: readonly Skill[];
  facts: ReadonlyMap<FactId, FactProgress>;
  onClose(): void;
}

/**
 * The Carnet: a tree per notion known by heart (« l'arbre des tables »), a branch per group
 * of facts, a leaf per fact that turns green as it comes at once; a complete branch blooms.
 */
export function Carnet({ skills, facts, onClose }: Props) {
  const [shown, setShown] = useState(skills[0]);
  const [picked, setPicked] = useState<FactId | null>(null);
  const pick = (skill: Skill) => {
    setShown(skill);
    setPicked(null);
  };
  return (
    <section id="carnet" role="dialog" aria-label="Carnet">
      <p class="praise">Ton carnet</p>
      {skills.length > 1 ? (
        <div class="tabs">
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              aria-pressed={skill === shown}
              onPointerDown={() => pick(skill)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      ) : (
        <p class="instruction">{shown.name}</p>
      )}
      <FactTree skill={shown} facts={facts} picked={picked} onPick={setPicked} />
      <p class="caption" aria-live="polite">
        {picked ? captionOf(shown, picked, facts) : 'Touche une feuille.'}
      </p>
      <div class="actions">
        <button type="button" onPointerDown={onClose}>
          Fermer
        </button>
      </div>
    </section>
  );
}

function captionOf(skill: Skill, fact: FactId, facts: ReadonlyMap<FactId, FactProgress>): string {
  const { statement } = skill.facts!.exercise(fact, new Rng(0));
  const days = daysOf(facts.get(fact));
  if (days === AUTOMATED_DAYS) return `${statement} : tu le sais par cœur !`;
  if (days === 0) return `${statement} : sa première feuille t’attend.`;
  return `${statement} : ${plural(days, 'feuille', 'feuilles')} sur ${AUTOMATED_DAYS}.`;
}

// The tree in its own units: a trunk in the middle, branches on both sides, row after row.
const WIDTH = 900;
const HEIGHT = 470;
const TRUNK = WIDTH / 2;
const TOP = 110;
const BOTTOM = 400;
const REACH = 300;
const ROW_GAP = 26;
/** Leaves in a row along a branch; more go in rows above and under it. */
const PER_ROW = 9;
const LEAF = 19;

interface TreeProps {
  skill: Skill;
  facts: ReadonlyMap<FactId, FactProgress>;
  picked: FactId | null;
  onPick(fact: FactId): void;
}

function FactTree({ skill, facts, picked, onPick }: TreeProps) {
  const groups = skill.facts!.groups!;
  const rows = Math.ceil(groups.length / 2);
  const all = groups.every((group) => blooms(group, facts));
  return (
    <svg
      class={all ? 'tree bloom' : 'tree'}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-label={`L’arbre : ${skill.name}`}
    >
      <path
        class="trunk"
        d={`M${TRUNK - 26} ${HEIGHT} Q${TRUNK} ${TOP + 80} ${TRUNK - 6} ${TOP - 40} L${TRUNK + 6} ${TOP - 40} Q${TRUNK} ${TOP + 80} ${TRUNK + 26} ${HEIGHT}z`}
      />
      <g class="crown">
        <circle cx={TRUNK - 46} cy={TOP - 40} r="30" />
        <circle cx={TRUNK + 46} cy={TOP - 40} r="30" />
        <circle cx={TRUNK} cy={TOP - 62} r="40" />
      </g>
      {groups.map((group, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        const y = rows === 1 ? (TOP + BOTTOM) / 2 : BOTTOM - (row * (BOTTOM - TOP)) / (rows - 1);
        return (
          <Branch
            key={group.id}
            group={group}
            side={side}
            y={y}
            facts={facts}
            picked={picked}
            onPick={onPick}
          />
        );
      })}
    </svg>
  );
}

interface BranchProps {
  group: FactGroup;
  side: -1 | 1;
  y: number;
  facts: ReadonlyMap<FactId, FactProgress>;
  picked: FactId | null;
  onPick(fact: FactId): void;
}

/** A branch rising a little from the trunk, its leaves along it, its name at the tip. */
function Branch({ group, side, y, facts, picked, onPick }: BranchProps) {
  const tip = TRUNK + side * REACH;
  const rise = 26;
  const full = blooms(group, facts);
  const rows = Math.ceil(group.facts.length / PER_ROW);
  const perRow = Math.ceil(group.facts.length / rows);
  const size = LEAF;
  return (
    <g class={full ? 'branch bloom' : 'branch'} data-group={group.id}>
      <path
        class="wood"
        d={`M${TRUNK} ${y + 8} Q${TRUNK + (side * REACH) / 2} ${y + 4} ${tip} ${y - rise}`}
      />
      {group.facts.map((fact, j) => {
        const row = Math.floor(j / perRow);
        const t = ((j % perRow) + 1) / (perRow + 1);
        const x = TRUNK + side * (40 + t * (REACH - 40));
        const along = y + 6 - t * t * (rise + 4);
        // One row: leaves on both sides of the wood; more: rows above, under, then further.
        const upper = rows === 1 ? j % 2 === 0 : row % 2 === 0;
        const above = (upper ? -1 : 1) * ROW_GAP * (rows === 1 ? 0.55 : 0.8 + Math.floor(row / 2));
        const days = daysOf(facts.get(fact));
        return (
          <g
            key={fact}
            class={`leaf days-${days}${picked === fact ? ' picked' : ''}`}
            data-fact={fact}
            transform={`translate(${x} ${along + above})`}
            onPointerDown={() => onPick(fact)}
          >
            <circle class="touch" r={size + 6} />
            {days === 0 ? (
              <circle class="bud" r={size * 0.32} />
            ) : (
              <path
                class="blade"
                transform={`rotate(${above < 0 ? -40 : 140}) scale(${(size * (0.55 + (0.45 * days) / AUTOMATED_DAYS)) / 12})`}
                d="M0 0C0-8 5-13 12-13 12-6 7 0 0 0z"
              />
            )}
            {full && <circle class="flower" cx={size * 0.6} cy={-size * 0.6} r={size * 0.32} />}
          </g>
        );
      })}
      <text
        class="name"
        x={tip + side * 12}
        y={y - rise + 6}
        text-anchor={side < 0 ? 'end' : 'start'}
      >
        {group.name}
      </text>
    </g>
  );
}
