import * as THREE from 'three';
import { MeshWriter, grown } from '../mesh-data';

export const WATER_STILL = 0;
export const WATER_STREAM = 1;
export const WATER_FALL = 2;

export interface RibbonPoint {
  x: number;
  y: number;
  z: number;
  /** Unit direction across the ribbon, in the horizontal plane. */
  sx: number;
  sz: number;
  halfWidth: number;
  /** Shore value (0 open water, 1 bank or foam) at the centre and at the edges. */
  shoreCenter: number;
  shoreEdge: number;
  /** The centre bulges along the normal (waterfall sheets). */
  bulge?: number;
  /** Horizontal direction the sheet faces (waterfalls); flat water faces up. */
  outX?: number;
  outZ?: number;
}

/**
 * Builds all the water of a painting as one mesh for the water material.
 * uv = (distance along the flow, position across), aWater = (kind, shore).
 */
export class WaterBuilder extends MeshWriter {
  water = new Float32Array((this.positions.length / 3) * 2);

  protected override growVertices(capacity: number): void {
    super.growVertices(capacity);
    this.water = grown(this.water, capacity * 2);
  }

  point(
    x: number,
    y: number,
    z: number,
    along: number,
    across: number,
    kind: number,
    shore: number,
    nx = 0,
    ny = 1,
    nz = 0,
  ): number {
    const i = this.vertex(x, y, z, nx, ny, nz, along, across);
    this.water[i * 2] = kind;
    this.water[i * 2 + 1] = shore;
    return i;
  }

  /** Strip along a path, three vertices across. Returns the length of the path. */
  ribbon(points: readonly RibbonPoint[], kind: number, startAlong = 0): number {
    let along = startAlong;
    let previous = -1;
    for (let k = 0; k < points.length; k++) {
      const p = points[k];
      if (k > 0) {
        const q = points[k - 1];
        along += Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      }
      // Normal: up for flat water, facing outwards for a falling sheet.
      const a = points[Math.max(0, k - 1)];
      const b = points[Math.min(points.length - 1, k + 1)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const tz = b.z - a.z;
      let nx = -(p.sz * ty);
      let ny = p.sz * tx - p.sx * tz;
      let nz = p.sx * ty;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const facing = p.outX === undefined ? ny : nx * p.outX + nz * (p.outZ ?? 0) + ny * 0.2;
      if (facing < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const bulge = p.bulge ?? 0;
      const first = this.point(
        p.x - p.sx * p.halfWidth,
        p.y,
        p.z - p.sz * p.halfWidth,
        along,
        -1,
        kind,
        p.shoreEdge,
        nx,
        ny,
        nz,
      );
      this.point(
        p.x + nx * bulge,
        p.y + ny * bulge,
        p.z + nz * bulge,
        along,
        0,
        kind,
        p.shoreCenter,
        nx,
        ny,
        nz,
      );
      this.point(
        p.x + p.sx * p.halfWidth,
        p.y,
        p.z + p.sz * p.halfWidth,
        along,
        1,
        kind,
        p.shoreEdge,
        nx,
        ny,
        nz,
      );
      if (previous >= 0) {
        // Wind the triangles so their front face is on the side of the normal.
        const q = points[k - 1];
        const ex = p.x - q.x;
        const ey = p.y - q.y;
        const ez = p.z - q.z;
        const front = ey * p.sz * nx + (ez * p.sx - ex * p.sz) * ny + -ey * p.sx * nz > 0;
        for (let i = 0; i < 2; i++) {
          if (front) {
            this.triangle(previous + i, first + i, first + i + 1);
            this.triangle(previous + i, first + i + 1, previous + i + 1);
          } else {
            this.triangle(previous + i, first + i + 1, first + i);
            this.triangle(previous + i, previous + i + 1, first + i + 1);
          }
        }
      }
      previous = first;
    }
    return along;
  }

  build(material: THREE.Material): THREE.Mesh {
    const geometry = this.toGeometry();
    geometry.setAttribute(
      'aWater',
      new THREE.BufferAttribute(this.water.slice(0, this.vertexCount * 2), 2),
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.name = 'water';
    return mesh;
  }
}
