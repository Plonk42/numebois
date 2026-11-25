import { AUTOMATED_DAYS, isAutomated, type FactProgress } from '../core/facts';
import type { FactGroup, FactId, Skill } from '../core/types';

/** How far a fact is from « by heart »: 0 to `AUTOMATED_DAYS` leaves. */
function daysOf(progress: FactProgress | undefined): number {
  if (isAutomated(progress)) return AUTOMATED_DAYS;
  return Math.min(progress?.fastDays.length ?? 0, AUTOMATED_DAYS - 1);
}

/** A group in full bloom: all its facts known by heart. */
export function blooms(group: FactGroup, facts: ReadonlyMap<FactId, FactProgress>): boolean {
  return group.facts.every((fact) => isAutomated(facts.get(fact)));
}

// The tree in its own units, drawn at about one pixel per unit: a trunk in the middle,
// branches on both sides, row after row from the bottom.
const WIDTH = 1100;
const HEIGHT = 600;
const TRUNK = WIDTH / 2;
const LOW = 546;
const HIGH = 170;
/** The branches of a tree with a single row. */
const ALONE = 400;
const REACH = 340;
/** The tip of a branch rises this much above its foot. */
const RISE = 42;
/** Leaves in a row along a branch; more go in rows above and under it. */
const PER_ROW = 9;
const ROW_GAP = 36;
/** A leaf known by heart, its full size. */
const LEAF = 34;
const LEAF_PATH = 'M0 0C0-8 5-13 12-13 12-6 7 0 0 0z';

type Point = readonly [number, number];

function along(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
  ];
}

/** Where each leaf of a branch goes: along the wood, rows above and under it, turned outwards. */
function leafPlaces(
  count: number,
  foot: Point,
  bend: Point,
  tip: Point,
  side: -1 | 1,
  gap: number,
): { x: number; y: number; turn: number }[] {
  const rows = Math.ceil(count / PER_ROW);
  const perRow = Math.ceil(count / rows);
  const spread = ((rows - 1) / 2) * gap;
  return Array.from({ length: count }, (_, j) => {
    const row = Math.floor(j / perRow);
    const k = j % perRow;
    const t = 0.17 + (perRow === 1 ? 0.4 : (k * 0.75) / (perRow - 1));
    const [x, onWood] = along(foot, bend, tip, t);
    let offset = row * gap - spread;
    if (rows === 1) offset = k % 2 === 0 ? -6 : 6;
    const up = offset < 0 || (offset === 0 && k % 2 === 0);
    let turn = up ? -90 : 180;
    if (side > 0) turn = up ? 0 : 90;
    return { x, y: onWood + offset, turn };
  });
}

/** A fact's leaf: a bud, then a leaf that grows each day it comes at once; flowers once all bloom. */
function Leaf({
  days,
  turn,
  size,
  bloom,
}: {
  days: number;
  turn: number;
  size: number;
  bloom: boolean;
}) {
  return (
    <>
      {days === 0 ? (
        <circle class="bud" r={size * 0.22} />
      ) : (
        <path
          class="blade"
          transform={`rotate(${turn}) scale(${(size * (0.5 + (0.5 * days) / AUTOMATED_DAYS)) / 13})`}
          d={LEAF_PATH}
        />
      )}
      {bloom && (
        <g class="flower" transform="translate(4 -6)">
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} r={4.2} transform={`rotate(${a}) translate(0 -5)`} />
          ))}
          <circle class="heart" r={3} />
        </g>
      )}
    </>
  );
}

/** « La table de 7 » on its plank: « table de » small, « 7 » big; a name without number, big. */
function plankLabel(name: string): { small: string | null; big: string } {
  const match = /^(?:La |Le |Les )?(.*\D)\s(\d+)$/.exec(name);
  return match ? { small: match[1], big: match[2] } : { small: null, big: name };
}

function plankWidth(name: string): number {
  const { small, big } = plankLabel(name);
  return small ? Math.max(112, small.length * 10 + 28) : Math.max(112, big.length * 13 + 28);
}

/** The name of a group on the wooden plank at the tip of its branch. */
function Plank({ name, x, y }: { name: string; x: number; y: number }) {
  const { small, big } = plankLabel(name);
  const width = plankWidth(name);
  return (
    <g class="plank" transform={`translate(${x} ${y})`}>
      <rect x={-width / 2} y={-32} width={width} height={64} rx={12} />
      {small ? (
        <>
          <text class="small" y={-9}>
            {small}
          </text>
          <text class="big" y={24}>
            {big}
          </text>
        </>
      ) : (
        <text class="name" y={8}>
          {big}
        </text>
      )}
    </g>
  );
}

interface Props {
  skill: Skill;
  facts: ReadonlyMap<FactId, FactProgress>;
  /** The group Plume suggests: its branch glows. */
  glow: string | null;
  onPick(group: FactGroup): void;
}

/**
 * The tree of what is known by heart (#130): a branch per group of facts, a leaf per fact that
 * grows as it comes at once; a complete branch blooms. A touch on a branch picks it.
 */
export function FactTree({ skill, facts, glow, onPick }: Props) {
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
        d={`M${TRUNK - 46} ${HEIGHT} C${TRUNK - 30} ${HEIGHT - 160} ${TRUNK - 26} 240 ${TRUNK - 18} 70 L${TRUNK + 18} 70 C${TRUNK + 26} 240 ${TRUNK + 30} ${HEIGHT - 160} ${TRUNK + 46} ${HEIGHT}z`}
      />
      <path
        class="bark"
        d={`M${TRUNK - 8} ${HEIGHT - 20} C${TRUNK - 10} 420 ${TRUNK + 4} 300 ${TRUNK - 4} 150 M${TRUNK + 14} ${HEIGHT - 60} C${TRUNK + 12} 460 ${TRUNK + 18} 380 ${TRUNK + 10} 300`}
      />
      <g class="crown">
        <circle cx={TRUNK - 70} cy={78} r={52} />
        <circle cx={TRUNK + 70} cy={78} r={52} />
        <circle cx={TRUNK} cy={48} r={62} />
        <circle cx={TRUNK - 30} cy={98} r={44} />
        <circle cx={TRUNK + 34} cy={96} r={44} />
      </g>
      {groups.map((group, i) => (
        <Branch
          key={group.id}
          group={group}
          side={i % 2 ? 1 : -1}
          y={rows === 1 ? ALONE : LOW - (Math.floor(i / 2) * (LOW - HIGH)) / (rows - 1)}
          facts={facts}
          glow={group.id === glow}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

interface BranchProps {
  group: FactGroup;
  side: -1 | 1;
  y: number;
  facts: ReadonlyMap<FactId, FactProgress>;
  glow: boolean;
  onPick(group: FactGroup): void;
}

/** A branch rising from the trunk, its leaves along it, its plank at the tip: one target. */
function Branch({ group, side, y, facts, glow, onPick }: BranchProps) {
  const foot: Point = [TRUNK, y + 8];
  const tip: Point = [TRUNK + side * REACH, y + 8 - RISE];
  const bend: Point = [TRUNK + (side * REACH) / 2, y + 8];
  const wood = `M${foot} Q${bend} ${tip}`;
  const full = blooms(group, facts);
  const spread = ((Math.ceil(group.facts.length / PER_ROW) - 1) / 2) * ROW_GAP;
  const width = plankWidth(group.name);
  const plank = tip[0] + side * (width / 2 + 6);
  const edge = plank + (side * width) / 2;
  const inner = TRUNK + side * 26;
  // The whole band of the branch answers the finger, without reaching the next row.
  const band = [
    [inner, foot[1] - 40 - spread],
    [edge, tip[1] - 40 - spread],
    [edge, tip[1] + 46 + spread],
    [inner, foot[1] + 46 + spread],
  ]
    .map((p) => p.join(','))
    .join(' ');
  const places = leafPlaces(group.facts.length, foot, bend, tip, side, ROW_GAP);
  let classes = 'branch';
  if (full) classes += ' bloom';
  if (glow) classes += ' glow';
  return (
    <g
      class={classes}
      data-group={group.id}
      role="button"
      aria-label={group.name}
      onPointerDown={() => onPick(group)}
    >
      <polygon class="touch" points={band} />
      {glow && (
        <>
          <path class="halo" d={wood} />
          <rect
            class="halo"
            x={plank - width / 2 - 8}
            y={tip[1] - 40}
            width={width + 16}
            height={80}
            rx={20}
          />
        </>
      )}
      <path class="wood" d={wood} />
      <path class="wood-light" d={wood} />
      {group.facts.map((fact, j) => {
        const { x, y: at, turn } = places[j];
        const days = daysOf(facts.get(fact));
        return (
          <g
            key={fact}
            class={`leaf days-${days}`}
            data-fact={fact}
            transform={`translate(${x} ${at})`}
          >
            <Leaf days={days} turn={turn} size={LEAF} bloom={full} />
          </g>
        );
      })}
      <Plank name={group.name} x={plank} y={tip[1]} />
      {glow && <Sparkles x={plank} y={tip[1]} reach={width / 2} />}
    </g>
  );
}

function Sparkles({ x, y, reach }: { x: number; y: number; reach: number }) {
  const star = 'M0-10L2.5-2.5 10 0 2.5 2.5 0 10-2.5 2.5-10 0-2.5-2.5z';
  return (
    <g class="sparkles">
      <path transform={`translate(${x + reach + 12} ${y - 38}) scale(1.4)`} d={star} />
      <path transform={`translate(${x - reach - 14} ${y - 32})`} d={star} />
      <path transform={`translate(${x + reach - 8} ${y + 44}) scale(0.9)`} d={star} />
    </g>
  );
}

// The branch of a round, alone and bigger, on the card between two rounds.
const LONG = 860;
const TALL = 250;
const BIG_LEAF = 50;
const BIG_GAP = 52;

interface FactBranchProps {
  group: FactGroup;
  facts: ReadonlyMap<FactId, FactProgress>;
  /** Today's day number: the leaves of the facts that came at once today grow one by one. */
  today: number;
}

/**
 * The branch just played, in big (#131): the leaves that grew today pop one after the other,
 * and each lets a leaf fall towards Plume's basket.
 */
export function FactBranch({ group, facts, today }: FactBranchProps) {
  const full = blooms(group, facts);
  const width = plankWidth(group.name);
  const foot: Point = [24, TALL / 2 + 24];
  const tip: Point = [LONG - width - 18, TALL / 2 - 4];
  const bend: Point = [(LONG - width) / 2, TALL / 2 + 30];
  const wood = `M${foot} Q${bend} ${tip}`;
  const places = leafPlaces(group.facts.length, foot, bend, tip, 1, BIG_GAP);
  let order = 0;
  return (
    <svg
      class={full ? 'tree branch-card bloom' : 'tree branch-card'}
      viewBox={`0 0 ${LONG} ${TALL}`}
      aria-label={group.name}
    >
      <g class={full ? 'branch bloom' : 'branch'} data-group={group.id}>
        <path class="wood" d={wood} />
        <path class="wood-light" d={wood} />
        {group.facts.map((fact, j) => {
          const { x, y, turn } = places[j];
          const progress = facts.get(fact);
          const days = daysOf(progress);
          const grew = progress?.fastDays.includes(today) ?? false;
          const style = grew ? { '--order': order++ } : undefined;
          return (
            <g
              key={fact}
              class={`leaf days-${days}${grew ? ' grew' : ''}`}
              data-fact={fact}
              transform={`translate(${x} ${y})`}
            >
              <g class="pop" style={style}>
                <Leaf days={days} turn={turn} size={BIG_LEAF} bloom={full} />
              </g>
              {grew && (
                <g class="drop" style={style}>
                  <Leaf days={days} turn={turn} size={BIG_LEAF * 0.7} bloom={false} />
                </g>
              )}
            </g>
          );
        })}
        <Plank name={group.name} x={tip[0] + width / 2 + 6} y={tip[1]} />
      </g>
    </svg>
  );
}
