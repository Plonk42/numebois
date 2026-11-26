import { describe, expect, it } from 'vitest';
import { EAGLE_FEET, EAGLE_SCALE, soarPose } from '../../src/scene/render/soaring';
import { createMountain } from '../../src/scene/terrain/mountain';

const FPS = 30;

describe('eagles of the mountain', () => {
  it('soar smoothly, land on every summit in turn and take off again', () => {
    for (const seed of [3, 7, 12, 21]) {
      const terrain = createMountain(seed, 11);
      expect(terrain.drifters.map((d) => d.model)).toEqual(['eagle', 'eagle']);
      terrain.drifters.forEach((d, index) => {
        const perches = d.perches!;
        expect(perches.length, `seed ${seed}`).toBeGreaterThan(2);
        const visited = new Set<number>();
        let previous = soarPose(d, index, 0);
        let perched = 0;
        // Long enough for every summit.
        for (let f = 1; f <= FPS * 100 * perches.length; f++) {
          const pose = soarPose(d, index, f / FPS);
          const label = `seed ${seed}, eagle ${index}, ${(f / FPS).toFixed(2)} s`;
          const step = Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z);
          expect(step, label).toBeLessThan(0.3);
          const turn = Math.abs(
            ((pose.yaw - previous.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI,
          );
          expect(turn, label).toBeLessThan(0.15);
          const weights = pose.clips.reduce((sum, c) => sum + c.weight, 0);
          expect(weights, label).toBeCloseTo(1, 5);
          if (pose.clips.some((c) => c.clip === 'idle' && c.weight === 1)) {
            perched++;
            const at = perches.findIndex(
              ([x, y, z]) =>
                Math.hypot(pose.x - x, pose.z - z) < 1e-6 &&
                Math.abs(pose.y - y - EAGLE_FEET * EAGLE_SCALE * d.scale) < 1e-6,
            );
            expect(at, label).toBeGreaterThanOrEqual(0);
            visited.add(at);
          } else if (!pose.clips.some((c) => c.clip === 'jump' || c.clip === 'idle')) {
            // In flight, above the ground.
            const ground = terrain.surfaceAt(pose.x, pose.z)?.y ?? -Infinity;
            expect(pose.y, label).toBeGreaterThan(ground);
          }
          previous = pose;
        }
        expect(visited.size, `seed ${seed}, eagle ${index}`).toBe(perches.length);
        expect(perched, `seed ${seed}, eagle ${index}`).toBeGreaterThan(0);
      });
    }
  });

  it('land on the highest point of the ground on each summit risen', () => {
    for (const stage of [9, 10, 11] as const) {
      const terrain = createMountain(12, stage);
      for (const d of terrain.drifters) {
        const tops = d.perches!.map(([, y]) => y);
        expect(tops).toEqual([...tops].sort((p, q) => q - p));
        for (const [x, y, z] of d.perches!) {
          expect(terrain.surfaceAt(x, z)!.y, `stage ${stage}`).toBeGreaterThan(y - 1.5);
        }
      }
    }
  });
});
