import type { Rng } from '../../core/rng';
import type { Family } from './families';

const TAU = Math.PI * 2;

/**
 * Skeleton of a tree: nodes with a position, a radius and a parent.
 * Port of the Blender prototype, with Y up.
 */
export class Skeleton {
  readonly x: number[] = [];
  readonly y: number[] = [];
  readonly z: number[] = [];
  readonly radius: number[] = [];
  readonly parent: number[] = [];
  readonly root: boolean[] = [];
  /** Trunk node a limb node hangs from (itself for trunk nodes, -1 for roots). */
  readonly anchor: number[] = [];
  /** Last trunk node. */
  trunkTop = 0;

  add(x: number, y: number, z: number, radius: number, parent: number, root = false): number {
    this.x.push(x);
    this.y.push(y);
    this.z.push(z);
    this.radius.push(radius);
    this.parent.push(parent);
    this.root.push(root);
    this.anchor.push(-1);
    return this.x.length - 1;
  }

  get count(): number {
    return this.x.length;
  }

  children(): number[][] {
    const kids: number[][] = this.x.map(() => []);
    this.parent.forEach((p, i) => {
      if (p >= 0) kids[p].push(i);
    });
    return kids;
  }

  /**
   * Birth age of each node: path length from the trunk base, normalised so the farthest
   * branch tip is born at 1. Cutting the skeleton at an age gives a growth stage.
   */
  ages(): number[] {
    const dist = new Array<number>(this.count).fill(0);
    let top = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.parent[i];
      if (p >= 0) {
        dist[i] =
          dist[p] + Math.hypot(this.x[i] - this.x[p], this.y[i] - this.y[p], this.z[i] - this.z[p]);
      }
      if (!this.root[i]) top = Math.max(top, dist[i]);
    }
    return dist.map((d) => Math.min(1, d / top));
  }

  height(): number {
    return Math.max(...this.y);
  }
}

export type Vec = [number, number, number];

export function normalize(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function perpendicular(d: Vec): Vec {
  const a: Vec = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  return normalize(cross(d, a));
}

/** Rotate v around the unit axis by the angle (Rodrigues). */
export function rotate(v: Vec, axis: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - c);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

function jitter(rng: Rng, amount: number): Vec {
  return [rng.range(-1, 1) * amount, rng.range(-1, 1) * amount, rng.range(-1, 1) * amount];
}

function grow(
  sk: Skeleton,
  rng: Rng,
  start: number,
  dir: Vec,
  length: number,
  startRadius: number,
  depth: number,
  f: Family,
  anchor: number,
): void {
  let node = start;
  let d = dir;
  let radius = startRadius;
  let x = sk.x[node];
  let y = sk.y[node];
  let z = sk.z[node];
  for (let k = 0; k < 2; k++) {
    const j = jitter(rng, f.wobble);
    d = normalize([d[0] + j[0], d[1] + j[1] + 0.12, d[2] + j[2]]);
    x += (d[0] * length) / 2;
    y += (d[1] * length) / 2;
    z += (d[2] * length) / 2;
    radius *= 0.85;
    node = sk.add(x, y, z, radius, node);
    sk.anchor[node] = anchor;
  }
  if (depth === 0) return;
  const az = rng.range(0, TAU);
  const side0 = perpendicular(d);
  for (let i = 0; i < 2; i++) {
    const side = rotate(side0, d, az + i * Math.PI);
    const spread = rng.range(0.5, 0.9);
    const j = jitter(rng, 0.25);
    const child = normalize([
      d[0] + side[0] * spread + j[0],
      d[1] + side[1] * spread + j[1],
      d[2] + side[2] * spread + j[2],
    ]);
    grow(sk, rng, node, child, length * 0.72, radius * 0.72, depth - 1, f, anchor);
  }
}

/** Build the skeleton of a tree of this family. `depth` can lower the family's fork levels. */
export function buildSkeleton(rng: Rng, f: Family, depth = f.depth, roots = true): Skeleton {
  const sk = new Skeleton();
  let node = sk.add(0, -0.25, 0, f.radius * 1.3, -1);
  sk.anchor[node] = node;
  let x = 0;
  let y = -0.25;
  let z = 0;
  let d: Vec = [0, 1, 0];
  const lean = f.shape === 'conifer' ? 0.03 : 0.1;
  const leanX = rng.range(-1, 1) * lean;
  const leanZ = rng.range(-1, 1) * lean;
  const trunk: number[] = [];
  for (let k = 1; k <= 4; k++) {
    const j = jitter(rng, f.shape === 'conifer' ? 0.03 : 0.1);
    d = normalize([d[0] + j[0] + leanX, d[1] + j[1], d[2] + j[2] + leanZ]);
    const step = (f.height + 0.25) / 4;
    x += d[0] * step;
    y += d[1] * step;
    z += d[2] * step;
    node = sk.add(x, y, z, f.radius * (1.15 - (0.4 * k) / 4), node);
    sk.anchor[node] = node;
    trunk.push(node);
  }
  sk.trunkTop = trunk[trunk.length - 1];
  const a0 = rng.range(0, TAU);
  if (f.shape === 'broadleaf') {
    const n = rng.int(f.limbs[0], f.limbs[1]);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * TAU) / n + rng.range(-0.3, 0.3);
      const tilt = ((f.limbAngle + rng.range(-10, 10)) * Math.PI) / 180;
      const dir: Vec = [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)];
      const start = i > 0 ? trunk[trunk.length - 1] : trunk[trunk.length - 2];
      grow(
        sk,
        rng,
        start,
        dir,
        f.limbLength * rng.range(0.8, 1.15),
        f.radius * 0.7,
        depth,
        f,
        start,
      );
    }
  }
  const rootCount = roots ? rng.int(3, 5) : 0;
  for (let i = 0; i < rootCount; i++) {
    const a = a0 + (i * TAU) / 4 + rng.range(-0.4, 0.4);
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const r = f.radius;
    let p = sk.add(ox * r * 0.3, 0.4, oz * r * 0.3, r * 0.75, -1, true);
    p = sk.add(ox * (r + 0.22), 0.1, oz * (r + 0.22), r * 0.5, p, true);
    const reach = r + 0.5 * rng.range(0.8, 1.3);
    sk.add(ox * reach, -0.08, oz * reach, r * 0.15, p, true);
  }
  return sk;
}

/**
 * Split the skeleton into tubes. A side branch starts inside its parent, so each chain of
 * a fork begins with the fork node.
 */
export function chains(sk: Skeleton): number[][] {
  const kids = sk.children();
  const starts: [number, number][] = [];
  for (let i = sk.count - 1; i >= 0; i--) if (sk.parent[i] < 0) starts.push([i, -1]);
  const out: number[][] = [];
  while (starts.length > 0) {
    const [first, pre] = starts.pop()!;
    let n = first;
    const chain = pre >= 0 ? [pre, n] : [n];
    while (kids[n].length > 0) {
      const p = sk.parent[n];
      const d: Vec =
        p >= 0 ? normalize([sk.x[n] - sk.x[p], sk.y[n] - sk.y[p], sk.z[n] - sk.z[p]]) : [0, 1, 0];
      let main = kids[n][0];
      let best = -Infinity;
      for (const c of kids[n]) {
        const cd = normalize([sk.x[c] - sk.x[n], sk.y[c] - sk.y[n], sk.z[c] - sk.z[n]]);
        const dot = cd[0] * d[0] + cd[1] * d[1] + cd[2] * d[2];
        if (dot > best) {
          best = dot;
          main = c;
        }
      }
      for (const c of kids[n]) if (c !== main) starts.push([c, n]);
      n = main;
      chain.push(n);
    }
    out.push(chain);
  }
  return out;
}
