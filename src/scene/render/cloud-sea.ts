import * as THREE from 'three';
import { FOG_PARS, fogUniforms } from './particles';
import { sunDirection } from './lighting';
import type { Ambience } from './richness';

/** Segments around and rings out of the sea of clouds: dense near, wide towards the horizon. */
const SEGMENTS = 56;
const NEAR_RINGS = 12;
const FAR_RINGS = 8;
const NEAR_RADIUS = 64;
const FAR_RADIUS = 520;
export const CLOUD_SEA_TRIANGLES = SEGMENTS * (1 + 2 * (NEAR_RINGS + FAR_RINGS - 1));
/** Height of the billows above the level of the sea. */
const BILLOW = 4.2;

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uSun;
varying float vDepth;
varying float vLight;
varying float vHeight;

// Rounded billows, creased between them, drifting slowly with the wind.
float billow(vec2 p) {
  float a = sin(p.x * 0.11 + 1.7 * sin(p.y * 0.08));
  float b = sin(p.y * 0.14 + 1.3 * sin(p.x * 0.07 + 1.1));
  float c = sin(p.x * 0.23 + 0.9 * sin(p.y * 0.19 + 0.4));
  float d = sin(p.y * 0.26 + 1.1 * sin(p.x * 0.17 + 2.3));
  return 0.62 * sqrt(abs(a * b)) + 0.38 * sqrt(abs(c * d));
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 p = world.xz + uTime * uMotion * vec2(0.45, 0.12);
  // Flatter far away, where the haze takes over.
  float amp = ${BILLOW.toFixed(1)} * (1.0 - 0.7 * smoothstep(90.0, 260.0, length(world.xz)));
  float h = billow(p);
  float e = 1.2;
  vec3 n = normalize(vec3(-(billow(p + vec2(e, 0.0)) - h) / e * amp, 1.0, -(billow(p + vec2(0.0, e)) - h) / e * amp));
  vLight = clamp(dot(n, uSun) * 0.85 + 0.25, 0.0, 1.0);
  vHeight = h;
  world.y += amp * h;
  vec4 mv = viewMatrix * world;
  // The clouds stay clearer than the haze around them.
  vDepth = -mv.z * 0.6;
  gl_Position = projectionMatrix * mv;
}
`;

// Smooth like the KayKit clouds: lit tops, lilac hollows.
const FRAGMENT = /* glsl */ `
${FOG_PARS}
uniform vec3 uLit;
uniform vec3 uShade;
varying float vLight;
varying float vHeight;
void main() {
  vec3 color = mix(uShade, uLit, vLight) * (0.86 + 0.18 * vHeight);
  gl_FragColor = vec4(withFog(color), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The sea of clouds under the sky islands (#32): a wide disc of billows lit by the sun,
 * drifting slowly (still in low quality), fading into the haze at the horizon.
 */
export class CloudSea {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    level: number,
    ambience: Ambience,
    shared: { uTime: { value: number } },
    motion: boolean,
  ) {
    const radii: number[] = [];
    for (let k = 1; k <= NEAR_RINGS; k++) radii.push(NEAR_RADIUS * Math.pow(k / NEAR_RINGS, 1.25));
    for (let k = 1; k <= FAR_RINGS; k++) {
      radii.push(NEAR_RADIUS * Math.pow(FAR_RADIUS / NEAR_RADIUS, k / FAR_RINGS));
    }
    const positions: number[] = [0, 0, 0];
    const indices: number[] = [];
    radii.forEach((radius, r) => {
      // Every other ring turns by half a segment, for triangles of even size.
      const turn = (r % 2) * 0.5;
      for (let s = 0; s < SEGMENTS; s++) {
        const a = ((s + turn) / SEGMENTS) * Math.PI * 2;
        positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      }
      const base = 1 + r * SEGMENTS;
      for (let s = 0; s < SEGMENTS; s++) {
        const t = (s + 1) % SEGMENTS;
        if (r === 0) {
          indices.push(0, base + t, base + s);
          continue;
        }
        const inner = base - SEGMENTS;
        indices.push(inner + s, base + t, base + s);
        indices.push(inner + s, inner + t, base + t);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const sun = new THREE.Color(ambience.sun.color);
    const fog = new THREE.Color(ambience.fog.color);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: shared.uTime,
        uMotion: { value: motion ? 1 : 0 },
        // Silver-blue under the moon (#85).
        uLit: { value: new THREE.Color(ambience.night ? 0x7484b8 : 0xffffff).lerp(sun, 0.35) },
        uShade: {
          value: fog.clone().lerp(new THREE.Color(ambience.sky.zenith), 0.45).multiplyScalar(0.72),
        },
        uSun: { value: sunDirection(ambience) },
        ...fogUniforms(),
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(0, level, 0);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'cloud-sea';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
