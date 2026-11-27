import { useMemo } from 'preact/hooks';
import { drillPaysToday } from '../core/drill';
import { AUTOMATED_DAYS, isKnown, paysToday, type FactProgress } from '../core/facts';
import type { FactGroup, FactId, Skill } from '../core/types';
import type { TuftSprites, WoodPiece } from '../scene/render/fact-tree-art';
import { TREE_HEIGHT, TREE_WIDTH, branchLayout, treeLayout } from './fact-tree-layout';

/** The tree drawn with the models of the forest; null while they load. */
export interface TreeArt {
  factTree(
    key: string,
    wood: readonly WoodPiece[],
    width: number,
    height: number,
    ground: boolean,
  ): string | null;
  factTufts(): TuftSprites | null;
}

/** How far a fact is from « by heart »: 0 to `AUTOMATED_DAYS` days. */
function daysOf(progress: FactProgress | undefined): number {
  if (isKnown(progress)) return AUTOMATED_DAYS;
  return Math.min(progress?.fastDays.length ?? 0, AUTOMATED_DAYS - 1);
}

/** A group in full bloom: all its facts known by heart. */
export function blooms(group: FactGroup, facts: ReadonlyMap<FactId, FactProgress>): boolean {
  return group.facts.every((fact) => isKnown(facts.get(fact)));
}

/** The tuft of a fact, by days: a bud, then bigger each day it came at once. */
const TUFT = [22, 32, 42, 54];
const BLOOM_TUFT = 58;

/** A fact's tuft on its little twig; flowers once its whole branch is known. */
function FactTuft({
  days,
  bloom,
  turn,
  sprites,
  scale = 1,
}: {
  days: number;
  bloom: boolean;
  turn: number;
  sprites: TuftSprites | null;
  scale?: number;
}) {
  const size = (bloom ? BLOOM_TUFT : TUFT[days]) * scale;
  if (!sprites) return <circle class="tuft" r={size * 0.4} />;
  let set = sprites.grown;
  if (bloom) set = sprites.bloom;
  else if (days === 0) set = sprites.bud;
  else if (days === 1) set = sprites.young;
  return (
    <image href={set[turn % set.length]} x={-size / 2} y={-size / 2} width={size} height={size} />
  );
}

/** « La table de 7 »: « table de » small, « 7 » big; a name without number on one or two lines. */
function labelText(name: string): { small: string | null; lines: string[] } {
  const match = /^(?:La |Le |Les )?(.*\D)\s(\d+)$/.exec(name);
  if (match) return { small: match[1], lines: [match[2]] };
  if (name.length <= 13) return { small: null, lines: [name] };
  // Two lines, cut at the space nearest the middle.
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index);
  const cut = spaces.reduce((a, b) =>
    Math.abs(b - name.length / 2) < Math.abs(a - name.length / 2) ? b : a,
  );
  return { small: null, lines: [name.slice(0, cut), name.slice(cut + 1)] };
}

/** The size of the tuft that carries a name. */
function labelBox(name: string): { width: number; height: number } {
  const { small, lines } = labelText(name);
  const longest = Math.max(...lines.map((line) => line.length));
  let width = longest * 11.5 + 24;
  let height = 34;
  if (small) {
    width = Math.max(84, small.length * 9 + 20, longest * 20 + 20);
    height = 58;
  } else if (lines.length > 1) {
    width = longest * 10.5 + 24;
    height = 54;
  }
  // The tuft is round: the words keep to its middle.
  return { width: width * 1.15 + 40, height: Math.max(96, height * 1.4 + 34) };
}

interface LabelProps {
  name: string;
  x: number;
  y: number;
  tilt?: number;
  bloom: boolean;
  gift: boolean;
  /** The side of the tree: the gift goes on the outer corner. */
  side: -1 | 1;
  sprites: TuftSprites | null;
}

/**
 * The name of a group in a light tuft at the tip of its branch (a plank while the models load);
 * a leaf on it while the branch still gives leaves today (#143).
 */
function Label({ name, x, y, tilt = 0, bloom, gift, side, sprites }: LabelProps) {
  const { small, lines } = labelText(name);
  const { width, height } = labelBox(name);
  const big = lines.length === 1 && small ? 'big' : 'name';
  return (
    <g class="plank" transform={`translate(${x} ${y}) rotate(${tilt})`}>
      {sprites ? (
        <image
          href={bloom ? sprites.labelBloom : sprites.label}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          preserveAspectRatio="none"
        />
      ) : (
        <rect
          x={-width / 2 + 16}
          y={-height / 2 + 18}
          width={width - 32}
          height={height - 36}
          rx={12}
        />
      )}
      {gift && (
        <g class="gift" transform={`translate(${side * (width / 2 - 16)} ${-height / 2 + 16})`}>
          <circle r={17} />
          <path transform="translate(-12 -12)" d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" />
        </g>
      )}
      {small && (
        <text class="small" y={-9}>
          {small}
        </text>
      )}
      {lines.map((line, i) => (
        <text key={line} class={big} y={small ? 22 : lines.length > 1 ? (i === 0 ? -4 : 20) : 8}>
          {line}
        </text>
      ))}
    </g>
  );
}

/** The wood as plain strokes, while the models load. */
function BareWood({ wood }: { wood: readonly WoodPiece[] }) {
  return (
    <g class="bare">
      {wood.map((piece, i) => (
        <path
          key={i}
          d={`M${piece.points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}`}
          stroke-width={piece.radii[0] * 1.6}
        />
      ))}
    </g>
  );
}

interface Props {
  skill: Skill;
  facts: ReadonlyMap<FactId, FactProgress>;
  /** The group Plume suggests: its branch glows. */
  glow: string | null;
  /** Today: the branches that still give leaves show it. */
  day: number;
  art: TreeArt;
  onPick(group: FactGroup): void;
}

/**
 * The tree of what is known by heart (#130, #151): a branch per group of facts, a tuft per fact
 * on a little twig of its own, that grows as the fact comes at once; a complete branch blooms.
 * A touch on a branch picks it.
 */
export function FactTree({ skill, facts, glow, day, art, onPick }: Props) {
  const groups = skill.facts!.groups!;
  const layout = useMemo(
    () =>
      treeLayout(
        groups.map((group) => ({ count: group.facts.length, label: labelBox(group.name) })),
        skill.id,
      ),
    [skill],
  );
  const wood = art.factTree(`tree:${skill.id}`, layout.wood, TREE_WIDTH, TREE_HEIGHT, true);
  const sprites = art.factTufts();
  const all = groups.every((group) => blooms(group, facts));
  // Under its daily cap, the drill still gives leaves today (#29).
  const open = drillPaysToday(facts, day);
  return (
    <svg
      class={all ? 'tree bloom' : 'tree'}
      viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`}
      aria-label={`L’arbre : ${skill.name}`}
    >
      {wood ? (
        <image class="timber" href={wood} width={TREE_WIDTH} height={TREE_HEIGHT} />
      ) : (
        <BareWood wood={layout.wood} />
      )}
      {groups.map((group, i) => {
        const branch = layout.branches[i];
        const full = blooms(group, facts);
        let classes = 'branch';
        if (full) classes += ' bloom';
        if (group.id === glow) classes += ' glow';
        const { width, height } = labelBox(group.name);
        return (
          <g
            key={group.id}
            class={classes}
            data-group={group.id}
            role="button"
            aria-label={group.name}
            onPointerDown={() => onPick(group)}
          >
            <path class="touch" d={branch.touch} />
            {group.id === glow && (
              <>
                <path class="halo" d={branch.wood} />
                <ellipse
                  class="halo"
                  cx={branch.label.x}
                  cy={branch.label.y}
                  rx={width / 2 + 6}
                  ry={height / 2 + 4}
                />
              </>
            )}
            {group.facts.map((fact, j) => (
              <g
                key={fact}
                class={`leaf days-${daysOf(facts.get(fact))}`}
                data-fact={fact}
                transform={`translate(${Math.round(branch.tufts[j].x)} ${Math.round(branch.tufts[j].y)})`}
              >
                <FactTuft
                  days={daysOf(facts.get(fact))}
                  bloom={full}
                  turn={i + j}
                  sprites={sprites}
                />
              </g>
            ))}
            <Label
              name={group.name}
              {...branch.label}
              bloom={full}
              gift={open && group.facts.some((fact) => paysToday(facts.get(fact), day))}
              side={branch.label.x < TREE_WIDTH / 2 ? -1 : 1}
              sprites={sprites}
            />
            {group.id === glow && (
              <Sparkles x={branch.label.x} y={branch.label.y} reach={width / 2} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Sparkles({ x, y, reach }: { x: number; y: number; reach: number }) {
  const star = 'M0-10L2.5-2.5 10 0 2.5 2.5 0 10-2.5 2.5-10 0-2.5-2.5z';
  return (
    <g class="sparkles">
      <path transform={`translate(${x + reach - 4} ${y - 40}) scale(1.4)`} d={star} />
      <path transform={`translate(${x - reach + 2} ${y - 30})`} d={star} />
      <path transform={`translate(${x + reach - 16} ${y + 42}) scale(0.9)`} d={star} />
    </g>
  );
}

// The branch of a round, alone and bigger, on the card between two rounds.
const LONG = 860;
const TALL = 250;
/** Its tufts, bigger than on the tree. */
const BIG = 1.35;

interface FactBranchProps {
  group: FactGroup;
  facts: ReadonlyMap<FactId, FactProgress>;
  /** Today's day number: the tufts of the facts that came at once today grow one by one. */
  today: number;
  art: TreeArt;
}

/**
 * The branch just played, in big (#131): the tufts that grew today pop one after the other,
 * and each lets a leaf fall towards Plume's basket.
 */
export function FactBranch({ group, facts, today, art }: FactBranchProps) {
  const full = blooms(group, facts);
  const box = labelBox(group.name);
  const layout = useMemo(
    () => branchLayout(group.facts.length, box, { width: LONG, height: TALL }, group.id),
    [group],
  );
  const wood = art.factTree(`branch:${group.id}`, layout.wood, LONG, TALL, false);
  const sprites = art.factTufts();
  let order = 0;
  return (
    <svg
      class={full ? 'tree branch-card bloom' : 'tree branch-card'}
      viewBox={`0 0 ${LONG} ${TALL}`}
      aria-label={group.name}
    >
      {wood ? (
        <image class="timber" href={wood} width={LONG} height={TALL} />
      ) : (
        <BareWood wood={layout.wood} />
      )}
      <g class={full ? 'branch bloom' : 'branch'} data-group={group.id}>
        {group.facts.map((fact, j) => {
          const { x, y } = layout.tufts[j];
          const progress = facts.get(fact);
          const days = daysOf(progress);
          const grew = progress?.fastDays.includes(today) ?? false;
          const style = grew ? { '--order': order++ } : undefined;
          return (
            <g
              key={fact}
              class={`leaf days-${days}${grew ? ' grew' : ''}`}
              data-fact={fact}
              transform={`translate(${Math.round(x)} ${Math.round(y)})`}
            >
              <g class="pop" style={style}>
                <FactTuft days={days} bloom={full} turn={j} sprites={sprites} scale={BIG} />
              </g>
              {grew && (
                <g class="drop" style={style}>
                  <FactTuft days={1} bloom={false} turn={j} sprites={sprites} scale={BIG * 0.8} />
                </g>
              )}
            </g>
          );
        })}
        <Label
          name={group.name}
          {...layout.label}
          bloom={full}
          gift={false}
          side={1}
          sprites={sprites}
        />
      </g>
    </svg>
  );
}
