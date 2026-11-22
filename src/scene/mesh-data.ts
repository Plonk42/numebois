import * as THREE from 'three';

/** Plain indexed triangle mesh, kept on the CPU to be merged or instanced. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function boundsOf(data: MeshData): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = data.positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

export function triangleCount(data: MeshData): number {
  return data.indices.length / 3;
}

/** Read a (possibly quantized) geometry with its world matrix baked in. */
export function meshDataOf(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): MeshData {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const count = pos.count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const v = new THREE.Vector3();
  const normalMatrix = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    if (matrix) v.applyMatrix4(matrix);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    v.fromBufferAttribute(nor, i);
    if (normalMatrix) v.applyMatrix3(normalMatrix);
    v.normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
    uvs[i * 2] = uv.getX(i);
    uvs[i * 2 + 1] = uv.getY(i);
  }
  const index = geometry.getIndex();
  const indices = new Uint32Array(index ? index.count : count);
  for (let i = 0; i < indices.length; i++) indices[i] = index ? index.getX(i) : i;
  return { positions, normals, uvs, indices };
}

export function bufferGeometryOf(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return geometry;
}

/** Growable buffers to assemble a merged mesh without per-part allocations. */
export class MeshWriter {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  vertexCount = 0;
  indexCount = 0;

  constructor(vertexCapacity = 4096, indexCapacity = 8192) {
    this.positions = new Float32Array(vertexCapacity * 3);
    this.normals = new Float32Array(vertexCapacity * 3);
    this.uvs = new Float32Array(vertexCapacity * 2);
    this.indices = new Uint32Array(indexCapacity);
  }

  protected growVertices(capacity: number): void {
    this.positions = grown(this.positions, capacity * 3);
    this.normals = grown(this.normals, capacity * 3);
    this.uvs = grown(this.uvs, capacity * 2);
  }

  reserve(vertices: number, indices: number): void {
    const needV = this.vertexCount + vertices;
    if (needV * 3 > this.positions.length) this.growVertices(Math.max(needV, this.vertexCount * 2));
    const needI = this.indexCount + indices;
    if (needI > this.indices.length) {
      this.indices = grown(this.indices, Math.max(needI, this.indexCount * 2));
    }
  }

  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ) {
    this.reserve(1, 0);
    const i = this.vertexCount++;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.normals[i * 3] = nx;
    this.normals[i * 3 + 1] = ny;
    this.normals[i * 3 + 2] = nz;
    this.uvs[i * 2] = u;
    this.uvs[i * 2 + 1] = v;
    return i;
  }

  triangle(a: number, b: number, c: number): void {
    this.reserve(0, 3);
    this.indices[this.indexCount++] = a;
    this.indices[this.indexCount++] = b;
    this.indices[this.indexCount++] = c;
  }

  /** Three independent vertices with the face normal and one UV: a flat, single-colour facet. */
  facet(
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    uv: readonly [number, number],
  ): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const i = this.vertex(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1]);
    this.vertex(b[0], b[1], b[2], nx, ny, nz, uv[0], uv[1]);
    this.vertex(c[0], c[1], c[2], nx, ny, nz, uv[0], uv[1]);
    this.triangle(i, i + 1, i + 2);
  }

  /**
   * Append a model with a transform (scale, then yaw around Y, then translation) and a UV
   * offset. Returns the index of its first vertex.
   */
  append(
    data: MeshData,
    x: number,
    y: number,
    z: number,
    yaw = 0,
    sx = 1,
    sy = sx,
    sz = sx,
    du = 0,
    dv = 0,
  ): number {
    const count = data.positions.length / 3;
    this.reserve(count, data.indices.length);
    const base = this.vertexCount;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    // Normals of a non-uniform scale use the inverse scale.
    const ix = 1 / sx;
    const iy = 1 / sy;
    const iz = 1 / sz;
    for (let i = 0; i < count; i++) {
      const px = data.positions[i * 3] * sx;
      const py = data.positions[i * 3 + 1] * sy;
      const pz = data.positions[i * 3 + 2] * sz;
      const o = (base + i) * 3;
      this.positions[o] = x + px * cos + pz * sin;
      this.positions[o + 1] = y + py;
      this.positions[o + 2] = z - px * sin + pz * cos;
      const nx = data.normals[i * 3] * ix;
      const ny = data.normals[i * 3 + 1] * iy;
      const nz = data.normals[i * 3 + 2] * iz;
      const len = Math.hypot(nx, ny, nz) || 1;
      this.normals[o] = (nx * cos + nz * sin) / len;
      this.normals[o + 1] = ny / len;
      this.normals[o + 2] = (-nx * sin + nz * cos) / len;
      const t = (base + i) * 2;
      this.uvs[t] = data.uvs[i * 2] + du;
      this.uvs[t + 1] = data.uvs[i * 2 + 1] + dv;
    }
    for (let i = 0; i < data.indices.length; i++) {
      this.indices[this.indexCount + i] = base + data.indices[i];
    }
    this.vertexCount += count;
    this.indexCount += data.indices.length;
    return base;
  }

  get triangles(): number {
    return this.indexCount / 3;
  }

  toMeshData(): MeshData {
    return {
      positions: this.positions.slice(0, this.vertexCount * 3),
      normals: this.normals.slice(0, this.vertexCount * 3),
      uvs: this.uvs.slice(0, this.vertexCount * 2),
      indices: this.indices.slice(0, this.indexCount),
    };
  }

  toGeometry(): THREE.BufferGeometry {
    return bufferGeometryOf(this.toMeshData());
  }
}

export function grown<T extends Float32Array | Uint32Array | Uint8Array>(
  array: T,
  length: number,
): T {
  const next = new (array.constructor as new (n: number) => T)(length);
  next.set(array);
  return next;
}
