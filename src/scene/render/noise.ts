import * as THREE from 'three';
import { Rng } from '../../core/rng';

/** Tileable two-channel value noise for the water shader (R and G are independent). */
export function createNoiseTexture(seed: number, size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const channels = [0, 1].map((channel) => {
    const rng = new Rng(seed + channel * 977);
    return [8, 16].map((period) => ({
      period,
      values: Array.from({ length: period * period }, () => rng.next()),
    }));
  });
  const sample = (octave: { period: number; values: number[] }, x: number, y: number) => {
    const p = octave.period;
    const fx = (x / size) * p;
    const fy = (y / size) * p;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const u = tx * tx * (3 - 2 * tx);
    const v = ty * ty * (3 - 2 * ty);
    const at = (ix: number, iy: number) => octave.values[(iy % p) * p + (ix % p)];
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      for (let channel = 0; channel < 2; channel++) {
        const [low, high] = channels[channel];
        data[i + channel] = Math.round(
          (sample(low, x, y) * 0.65 + sample(high, x, y) * 0.35) * 255,
        );
      }
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
