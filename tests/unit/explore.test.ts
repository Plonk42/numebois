import { describe, expect, it } from 'vitest';
import {
  clampView,
  EXPLORE_LIMITS,
  HOME_VIEW,
  parseViewShares,
  viewFromShares,
} from '../../src/scene/render/explore';

const half = [20, 15] as const;

describe('exploration de la forêt (#72)', () => {
  it('garde l’orientation, la plongée et le zoom dans leurs limites', () => {
    expect(clampView({ yaw: 90, pitch: -30, zoom: 9, x: 0, z: 0 }, half)).toEqual({
      yaw: EXPLORE_LIMITS.yaw,
      pitch: -EXPLORE_LIMITS.pitch,
      zoom: EXPLORE_LIMITS.zoom,
      x: 0,
      z: 0,
    });
    expect(clampView({ ...HOME_VIEW, zoom: 0.2 }, half).zoom).toBe(1);
  });

  it('ne déplace pas la vue au cadrage, puis dans le tableau seulement', () => {
    expect(clampView({ ...HOME_VIEW, x: 5, z: -5 }, half)).toEqual(HOME_VIEW);
    const zoom = EXPLORE_LIMITS.zoom;
    const room = 1 - 1 / zoom;
    for (let a = 0; a < 2 * Math.PI; a += 0.3) {
      const view = clampView(
        { ...HOME_VIEW, zoom, x: 100 * Math.cos(a), z: 100 * Math.sin(a) },
        half,
      );
      expect(Math.hypot(view.x / (half[0] * room), view.z / (half[1] * room))).toBeCloseTo(1, 6);
    }
    const inside = { ...HOME_VIEW, zoom, x: 2, z: -3 };
    expect(clampView(inside, half)).toEqual(inside);
  });

  it('lit une vue en parts des limites pour les captures', () => {
    expect(parseViewShares('1,-1,1,0,-1')).toEqual([1, -1, 1, 0, -1]);
    expect(parseViewShares('a,1')).toBeNull();
    expect(parseViewShares(null)).toBeNull();
    const room = 1 - 1 / EXPLORE_LIMITS.zoom;
    expect(viewFromShares([1, -1, 1, 0, -1], half)).toEqual({
      yaw: EXPLORE_LIMITS.yaw,
      pitch: -EXPLORE_LIMITS.pitch,
      zoom: EXPLORE_LIMITS.zoom,
      x: 0,
      z: -half[1] * room,
    });
    expect(viewFromShares([], half)).toEqual(HOME_VIEW);
  });
});
