import * as THREE from 'three';
import { Rng } from '../../core/rng';

/** Fog and output for the unlit effect shaders, matching the scene fog. */
export const FOG_PARS = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying float vDepth;
vec3 withFog(vec3 color) {
  return mix(color, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
}
`;

export interface FogUniforms {
  uFogColor: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
}

export const GLOW_POLLEN = 0;
export const GLOW_FIREFLY = 1;
export const GLOW_SPARKLE = 2;
export const GLOW_SNOW = 3;
export const GLOW_BURST = 4;

const GLOW_VERTEX = /* glsl */ `
attribute vec4 aSeed;
attribute float aKind;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
uniform vec3 uBurstOrigin;
uniform float uBurstTime;
varying vec4 vColor;
varying float vSoft;
varying float vDepth;

void main() {
  vec3 p = position;
  float size = 1.0;
  float alpha = 1.0;
  float solid = 0.0;
  float t = uTime;
  if (aKind < 0.5) {
    // Pollen: slow drift upwards, looping in a column.
    float loop = fract(t * 0.035 * (0.6 + aSeed.y) + aSeed.z);
    p += vec3(sin(t * 0.31 + aSeed.x * 6.28) * 1.3, loop * 5.0, cos(t * 0.27 + aSeed.w * 6.28) * 1.3);
    alpha = smoothstep(0.0, 0.15, loop) * (1.0 - smoothstep(0.8, 1.0, loop)) * 0.85;
    size = 0.09 + 0.06 * aSeed.x;
    solid = 0.5;
  } else if (aKind < 1.5) {
    // Firefly: wanders around its home and blinks.
    p += vec3(
      sin(t * 0.5 + aSeed.x * 6.28) * 1.3 + sin(t * 1.3 + aSeed.y * 6.28) * 0.4,
      sin(t * 0.7 + aSeed.z * 6.28) * 0.5,
      cos(t * 0.45 + aSeed.w * 6.28) * 1.3 + cos(t * 1.1 + aSeed.x * 6.28) * 0.4);
    alpha = 0.25 + 0.75 * smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(t * 1.9 + aSeed.x * 40.0));
    size = 0.5 + 0.2 * aSeed.y;
  } else if (aKind < 2.5) {
    // Sparkle: twinkles in place.
    alpha = pow(max(0.0, sin(t * (2.5 + aSeed.y * 2.0) + aSeed.x * 40.0)), 6.0);
    p.y += sin(t * 0.8 + aSeed.z * 6.28) * 0.15;
    size = 0.35 + 0.3 * aSeed.w;
  } else if (aKind < 3.5) {
    // Snowflake: falls and sways.
    float loop = fract(t * 0.06 * (0.7 + 0.6 * aSeed.y) + aSeed.z);
    p += vec3(sin(t * 0.6 + aSeed.x * 6.28) * 0.8, (1.0 - loop) * 9.0, cos(t * 0.5 + aSeed.w * 6.28) * 0.8);
    alpha = smoothstep(0.0, 0.1, loop) * (1.0 - smoothstep(0.92, 1.0, loop));
    size = 0.1 + 0.07 * aSeed.x;
    solid = 1.0;
  } else {
    // Growth burst: sparks thrown up and out from the new plant.
    float age = t - uBurstTime - aSeed.w * 0.35;
    float life = 1.3 + aSeed.y * 0.9;
    float a = aSeed.x * 6.283;
    vec3 dir = vec3(cos(a), 1.2 + aSeed.z * 1.6, sin(a));
    p = uBurstOrigin + dir * age * (1.6 + aSeed.y * 1.8) * (1.0 - 0.28 * age) + vec3(0.0, -1.1 * age * age, 0.0);
    alpha = (age > 0.0 && age < life) ? (1.0 - smoothstep(life * 0.5, life, age)) : 0.0;
    size = 0.22 + 0.2 * aSeed.z;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, size * uScale / vDepth);
  vColor = vec4(aColor, alpha);
  vSoft = solid;
}
`;

// Premultiplied output: vSoft = 0 adds light (glow), vSoft = 1 covers what is behind.
const GLOW_FRAGMENT = /* glsl */ `
${FOG_PARS}
varying vec4 vColor;
varying float vSoft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, r));
  a = a * a + 0.6 * (1.0 - smoothstep(0.0, 0.3, r));
  a = min(1.0, a) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, a * vSoft);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface GlowParticle {
  x: number;
  y: number;
  z: number;
  kind: number;
  color: THREE.Color;
}

/** Glowing dots in one draw call: pollen, fireflies, sparkles, snow and growth sparks. */
export class GlowPoints {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    particles: readonly GlowParticle[],
    seed: number,
    shared: { uTime: { value: number } },
  ) {
    const rng = new Rng(seed).fork('glow');
    const n = particles.length;
    const position = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 4);
    const kind = new Float32Array(n);
    const color = new Float32Array(n * 3);
    particles.forEach((p, i) => {
      position.set([p.x, p.y, p.z], i * 3);
      seeds.set([rng.next(), rng.next(), rng.next(), rng.next()], i * 4);
      kind[i] = p.kind;
      color.set([p.color.r, p.color.g, p.color.b], i * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.material = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uTime: shared.uTime,
        uScale: { value: 600 },
        uBurstOrigin: { value: new THREE.Vector3() },
        uBurstTime: { value: -100 },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 1 },
        uFogFar: { value: 1000 },
      },
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.name = 'glow';
  }

  /**
   * Point sizes are in world units: give the height of the drawing buffer and the camera.
   * `boost` enlarges the points of a large diorama, seen from further away.
   */
  setViewport(heightPx: number, camera: THREE.PerspectiveCamera, boost = 1): void {
    this.material.uniforms.uScale.value =
      (heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360))) * boost;
  }

  burst(origin: THREE.Vector3, time: number): void {
    this.material.uniforms.uBurstOrigin.value.copy(origin);
    this.material.uniforms.uBurstTime.value = time;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

const FLAP_VERTEX = /* glsl */ `
attribute vec3 aHome;
attribute vec4 aParams; // phase, radius, speed, size
attribute vec3 aColor;
attribute float aBird;
uniform float uTime;
varying vec3 vColor;
varying float vDepth;

void main() {
  float phase = aParams.x * 6.283;
  float t = uTime * aParams.z + phase;
  float r = aParams.y;
  // Looping path around the home point, and its direction of travel.
  vec3 path = vec3(cos(t) * r, 0.0, sin(t * 1.3 + phase) * r * 0.7);
  vec3 vel = vec3(-sin(t) * r, 0.0, cos(t * 1.3 + phase) * r * 0.91);
  path.y = mix(sin(uTime * 2.1 + phase) * 0.35 + sin(uTime * 5.3 + phase) * 0.08, sin(t * 0.7) * 0.8, aBird);
  vec2 fwd = normalize(vel.xz + vec2(1e-4, 0.0));
  float flap = sin(uTime * mix(15.0, 7.0, aBird) + phase * 3.0) * mix(1.0, 0.7, aBird);
  // The wing tip (|x| = 1) rotates around the body axis (z).
  vec3 local = position;
  // Birds have long narrow wings.
  local.xz *= mix(vec2(1.0), vec2(2.0, 0.45), aBird);
  float side = sign(local.x);
  float reach = abs(local.x);
  local.x = side * reach * cos(flap);
  local.y += reach * sin(flap);
  local *= aParams.w;
  vec3 world = aHome + path + vec3(fwd.y * local.x + fwd.x * local.z, local.y, -fwd.x * local.x + fwd.y * local.z);
  vColor = aColor * (0.82 + 0.18 * cos(flap));
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FLAT_FRAGMENT = /* glsl */ `
${FOG_PARS}
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(withFog(vColor), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Flapper {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  size: number;
  color: THREE.Color;
  bird: boolean;
}

export function fogUniforms(): FogUniforms {
  return {
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 1 },
    uFogFar: { value: 1000 },
  };
}

/** Butterflies and simple birds: two flapping wings, animated in the vertex shader. */
export class Flappers {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(items: readonly Flapper[], seed: number, shared: { uTime: { value: number } }) {
    const rng = new Rng(seed).fork('flappers');
    const geometry = new THREE.InstancedBufferGeometry();
    // Two wings of two triangles each, joined on the body axis.
    const wing = [0, 0, 0.5, 1, 0, 0.75, 0.9, 0, -0.1, 0, 0, 0.5, 0.9, 0, -0.1, 0, 0, -0.45];
    const vertices: number[] = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < wing.length; i += 3)
        vertices.push(wing[i] * side, wing[i + 1], wing[i + 2]);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    const n = items.length;
    const home = new Float32Array(n * 3);
    const params = new Float32Array(n * 4);
    const color = new Float32Array(n * 3);
    const bird = new Float32Array(n);
    items.forEach((f, i) => {
      home.set([f.x, f.y, f.z], i * 3);
      params.set([rng.next(), f.radius, f.speed * (rng.chance(0.5) ? 1 : -1), f.size], i * 4);
      color.set([f.color.r, f.color.g, f.color.b], i * 3);
      bird[i] = f.bird ? 1 : 0;
    });
    geometry.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 3));
    geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    geometry.setAttribute('aBird', new THREE.InstancedBufferAttribute(bird, 1));
    geometry.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      vertexShader: FLAP_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: { uTime: shared.uTime, ...fogUniforms() },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'flappers';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const LEAF_VERTEX = /* glsl */ `
attribute vec3 aHome;
attribute vec4 aSeed;
attribute vec3 aColor;
attribute float aFall;
uniform float uTime;
uniform vec2 uWindDir;
uniform vec3 uBurstOrigin;
uniform float uBurstTime;
varying vec3 vColor;
varying float vDepth;

void main() {
  vec3 center;
  float scale;
  float spin;
  if (aFall >= 0.0) {
    // Ambient leaf: falls from the canopy with the wind, looping.
    float loop = fract(uTime * 0.07 * (0.7 + 0.6 * aSeed.y) + aSeed.z);
    center = vec3(aHome.x, aHome.y - loop * loop * aFall, aHome.z);
    center.xz += uWindDir * loop * 3.0 + vec2(sin(uTime * 1.3 + aSeed.x * 6.28), cos(uTime * 1.1 + aSeed.w * 6.28)) * 0.5 * loop;
    scale = smoothstep(0.0, 0.08, loop) * (1.0 - smoothstep(0.93, 1.0, loop));
    spin = uTime * (2.0 + aSeed.x * 2.0) + aSeed.w * 6.28;
  } else {
    // Growth burst: leaves thrown around the new plant, then falling.
    float age = uTime - uBurstTime - aSeed.w * 0.3;
    float a = aSeed.x * 6.283;
    vec3 dir = vec3(cos(a), 1.4 + aSeed.z * 1.2, sin(a));
    center = uBurstOrigin + dir * age * (1.8 + aSeed.y * 1.6) * (1.0 - 0.22 * age) + vec3(0.0, -1.6 * age * age, 0.0);
    scale = (age > 0.0 && age < 2.6) ? smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(1.7, 2.6, age)) : 0.0;
    spin = age * (5.0 + aSeed.y * 4.0) + aSeed.z * 6.28;
  }
  // Tumbling: rotate the flat leaf around a tilted axis.
  float c = cos(spin);
  float s = sin(spin);
  vec3 local = position * (0.16 + 0.1 * aSeed.y) * scale;
  local = vec3(local.x * c - local.y * s, local.x * s + local.y * c, local.z);
  float c2 = cos(spin * 0.7 + aSeed.x);
  float s2 = sin(spin * 0.7 + aSeed.x);
  local = vec3(local.x, local.y * c2 - local.z * s2, local.y * s2 + local.z * c2);
  vColor = aColor * (0.8 + 0.2 * c2);
  vec4 mv = modelViewMatrix * vec4(center + local, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export interface Leaf {
  /** Point of the canopy the leaf falls from (ignored for burst leaves). */
  x: number;
  y: number;
  z: number;
  /** Height it falls, down to the ground. */
  fall: number;
  color: THREE.Color;
  /** Leaf of the growth burst instead of an ambient falling leaf. */
  burst: boolean;
}

/** Falling leaves and the leaves of the growth burst: small opaque tumbling shapes. */
export class Leaves {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    items: readonly Leaf[],
    seed: number,
    shared: { uTime: { value: number }; uWindDir: { value: THREE.Vector2 } },
  ) {
    const rng = new Rng(seed).fork('leaves');
    const geometry = new THREE.InstancedBufferGeometry();
    // A pointed leaf: two triangles.
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, -1, 0, 0.55, 0, 0, 0, 1, 0, 0, -1, 0, 0, 1, 0, -0.55, 0, 0]),
        3,
      ),
    );
    const n = items.length;
    const home = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 4);
    const color = new Float32Array(n * 3);
    const fall = new Float32Array(n);
    items.forEach((leaf, i) => {
      home.set([leaf.x, leaf.y, leaf.z], i * 3);
      seeds.set([rng.next(), rng.next(), rng.next(), rng.next()], i * 4);
      color.set([leaf.color.r, leaf.color.g, leaf.color.b], i * 3);
      fall[i] = leaf.burst ? -1 : leaf.fall;
    });
    geometry.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 3));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    geometry.setAttribute('aFall', new THREE.InstancedBufferAttribute(fall, 1));
    geometry.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      vertexShader: LEAF_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: shared.uTime,
        uWindDir: shared.uWindDir,
        uBurstOrigin: { value: new THREE.Vector3() },
        uBurstTime: { value: -100 },
        ...fogUniforms(),
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'leaves';
  }

  burst(origin: THREE.Vector3, time: number): void {
    this.material.uniforms.uBurstOrigin.value.copy(origin);
    this.material.uniforms.uBurstTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const FOAM_VERTEX = /* glsl */ `
attribute vec3 aHome;
attribute vec4 aSeed;
uniform float uTime;
varying vec3 vColor;
varying float vDepth;

void main() {
  // Each puff swells, drifts away from the fall and shrinks, in a loop.
  float loop = fract(uTime * (0.35 + 0.3 * aSeed.x) + aSeed.y);
  float a = aSeed.z * 6.283;
  float swell = sin(loop * 3.1416);
  vec3 center = aHome + vec3(cos(a), 0.0, sin(a)) * loop * (0.5 + aSeed.w * 0.9) + vec3(0.0, swell * 0.28, 0.0);
  vec3 world = center + position * swell * (0.2 + 0.22 * aSeed.w);
  vColor = mix(vec3(0.74, 0.88, 0.97), vec3(1.0), 0.5 + 0.5 * normal.y);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/** Foam at the foot of the waterfalls: opaque low-poly puffs, like tiny KayKit clouds. */
export class Foam {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    homes: readonly { x: number; y: number; z: number }[],
    seed: number,
    shared: { uTime: { value: number } },
  ) {
    const rng = new Rng(seed).fork('foam');
    const base = new THREE.IcosahedronGeometry(1, 0);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('normal', base.getAttribute('normal'));
    base.dispose();
    const n = homes.length;
    const home = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 4);
    homes.forEach((h, i) => {
      home.set([h.x, h.y, h.z], i * 3);
      seeds.set([rng.next(), rng.next(), rng.next(), rng.next()], i * 4);
    });
    geometry.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 3));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geometry.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      vertexShader: FOAM_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      uniforms: { uTime: shared.uTime, ...fogUniforms() },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'foam';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const RAY_VERTEX = /* glsl */ `
attribute float aPhase;
varying vec2 vUv;
varying float vPhase;
void main() {
  vUv = uv;
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RAY_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
varying float vPhase;
void main() {
  // Soft across the ray, fading at both ends, slowly breathing.
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  float pulse = 0.65 + 0.35 * sin(uTime * 0.35 + vPhase * 6.283);
  float a = across * across * along * pulse * uStrength;
  gl_FragColor = vec4(uColor * a, 0.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Sun rays: long additive quads slanted along the light, turned to the (nearly fixed)
 * camera. Sprites, not a full-screen pass.
 */
export class SunRays {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    seed: number,
    sunDir: THREE.Vector3,
    viewDir: THREE.Vector3,
    extent: { x: number; z: number },
    color: THREE.Color,
    strength: number,
    shared: { uTime: { value: number } },
  ) {
    const rng = new Rng(seed).fork('rays');
    const count = 4;
    const position: number[] = [];
    const uv: number[] = [];
    const phase: number[] = [];
    const index: number[] = [];
    // Width axis: perpendicular to the ray and to the view direction.
    const side = new THREE.Vector3().crossVectors(sunDir, viewDir).normalize();
    // Rays stay above the diorama: they end about 9 units over the ground.
    const size = extent.x / 20;
    const reach = Math.min(16, 9 / Math.max(0.2, sunDir.y)) * size;
    for (let i = 0; i < count; i++) {
      const gx = rng.range(-extent.x * 0.45, extent.x * 0.45) + sunDir.x * -3;
      const gz = rng.range(-extent.z * 0.5, extent.z * 0.35);
      const length = reach * rng.range(0.8, 1);
      const width = rng.range(1.0, 2.0) * size;
      const ph = rng.next();
      const base = position.length / 3;
      for (const [u, v] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]) {
        const w = (u - 0.5) * width * (0.7 + 0.6 * v);
        position.push(
          gx + sunDir.x * length * v + side.x * w,
          -0.5 + sunDir.y * length * v + side.y * w,
          gz + sunDir.z * length * v + side.z * w,
        );
        uv.push(u, v);
        phase.push(ph);
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(phase), 1));
    geometry.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: RAY_VERTEX,
      fragmentShader: RAY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        uTime: shared.uTime,
        uColor: { value: color },
        uStrength: { value: strength },
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.name = 'sun-rays';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const RAINBOW_SEGMENTS = 40;
export const RAINBOW_TRIANGLES = RAINBOW_SEGMENTS * 2;

const RAINBOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// uv = (along the arc, across the band from the inside).
const RAINBOW_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
void main() {
  // Hue from red on the outside to violet on the inside, in soft pastel bands.
  float h = (1.0 - vUv.y) * 0.8;
  vec3 col = clamp(vec3(abs(h * 6.0 - 3.0) - 1.0, 2.0 - abs(h * 6.0 - 2.0), 2.0 - abs(h * 6.0 - 4.0)), 0.0, 1.0);
  col = mix(col, vec3(1.0), 0.3);
  float band = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
  float ends = smoothstep(0.02, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 0.98, vUv.x));
  float a = band * ends * uStrength * (0.88 + 0.12 * sin(uTime * 0.4));
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Rainbow of the last stage: one translucent arc facing the (nearly fixed) camera. */
export class Rainbow {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    center: THREE.Vector3,
    radius: number,
    strength: number,
    shared: { uTime: { value: number } },
  ) {
    const position: number[] = [];
    const uv: number[] = [];
    const index: number[] = [];
    const width = radius * 0.11;
    for (let i = 0; i <= RAINBOW_SEGMENTS; i++) {
      const t = i / RAINBOW_SEGMENTS;
      const c = Math.cos(t * Math.PI);
      const s = Math.sin(t * Math.PI);
      for (const side of [0, 1]) {
        const r = radius + (side - 0.5) * width;
        position.push(center.x + c * r, center.y + s * r, center.z);
        uv.push(t, side);
      }
      if (i > 0) {
        const b = i * 2;
        index.push(b - 2, b - 1, b, b, b - 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geometry.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: RAINBOW_VERTEX,
      fragmentShader: RAINBOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uTime: shared.uTime, uStrength: { value: strength } },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'rainbow';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** Copy the scene fog into the unlit effect materials. */
export function applyFog(objects: readonly THREE.Object3D[], fog: THREE.Fog): void {
  for (const object of objects) {
    const material = (object as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    const uniforms = material?.uniforms as Partial<FogUniforms> | undefined;
    if (!uniforms?.uFogColor || !uniforms.uFogNear || !uniforms.uFogFar) continue;
    uniforms.uFogColor.value.copy(fog.color);
    uniforms.uFogNear.value = fog.near;
    uniforms.uFogFar.value = fog.far;
  }
}
