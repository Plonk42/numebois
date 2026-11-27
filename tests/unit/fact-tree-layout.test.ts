import { describe, expect, it } from 'vitest';
import { curriculum } from '../../src/core/registry';
import { DOMAINS, ORDER } from '../../src/domains';
import { TREE_HEIGHT, TREE_WIDTH, treeLayout, type TreeGroup } from '../../src/ui/fact-tree-layout';

const LABEL = { width: 150, height: 100 };

/** Whether (x, y) is in a touch area: squares `M x y h w v c h -w z`. */
function inside(path: string, x: number, y: number): boolean {
  return [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)/g)].some((m) => {
    const [left, top, width, height] = m.slice(1).map(Number);
    return x >= left && x < left + width && y >= top && y < top + height;
  });
}

function check(groups: TreeGroup[], seed: string) {
  const layout = treeLayout(groups, seed);
  expect(layout.branches).toHaveLength(groups.length);
  for (const [g, branch] of layout.branches.entries()) {
    expect(branch.tufts).toHaveLength(groups[g].count);
    const { x, y } = branch.label;
    const { width, height } = groups[g].label;
    expect(x - width / 2).toBeGreaterThanOrEqual(0);
    expect(x + width / 2).toBeLessThanOrEqual(TREE_WIDTH);
    expect(y - height / 2).toBeGreaterThanOrEqual(0);
    expect(y + height / 2).toBeLessThanOrEqual(TREE_HEIGHT);
    expect(inside(branch.touch, x, y), `${seed}: name of ${g} in its part`).toBe(true);
    let own = 0;
    for (const tuft of branch.tufts) {
      expect(tuft.x).toBeGreaterThan(0);
      expect(tuft.x).toBeLessThan(TREE_WIDTH);
      expect(tuft.y).toBeGreaterThan(0);
      expect(tuft.y).toBeLessThan(TREE_HEIGHT);
      if (inside(branch.touch, tuft.x, tuft.y)) own++;
    }
    // Twigs of two branches may cross: a tuft against another's can answer for it.
    expect(own / branch.tufts.length, `${seed}: tufts of ${g} in its part`).toBeGreaterThanOrEqual(
      0.6,
    );
    expect(branch.wood).not.toBe('');
  }
  return layout;
}

describe('l’arbre de ce qu’on sait par cœur (#151)', () => {
  it('place chaque fait, chaque nom et sa part de l’arbre, pour chaque notion à faits', () => {
    const trees = curriculum(DOMAINS, ORDER).filter((skill) => skill.facts?.groups);
    expect(trees.length).toBeGreaterThan(4);
    for (const skill of trees) {
      check(
        skill.facts!.groups!.map((group) => ({ count: group.facts.length, label: LABEL })),
        skill.id,
      );
    }
  });

  it('tient pour 1 à 9 groupes de 1 à 25 faits, quelle que soit la graine', () => {
    for (let n = 1; n <= 9; n++) {
      for (const count of [1, 3, 9, 25]) {
        for (let seed = 0; seed < 8; seed++) {
          check(
            Array.from({ length: n }, () => ({ count, label: LABEL })),
            `test-${n}-${count}-${seed}`,
          );
        }
      }
    }
  });

  it('dessine le même arbre pour la même notion', () => {
    const groups = [9, 9, 9].map((count) => ({ count, label: LABEL }));
    expect(treeLayout(groups, 'a')).toEqual(treeLayout(groups, 'a'));
    expect(treeLayout(groups, 'a')).not.toEqual(treeLayout(groups, 'b'));
  });
});
