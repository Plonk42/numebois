import * as THREE from 'three';
import type { AssetLibrary } from '../assets';
import { Rng } from '../../core/rng';
import type { Ambience } from './richness';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

// The camera looks down on the diorama, so the backdrop is a screen-space gradient:
// zenith colour at the top, a glowing horizon band, haze at the bottom.
const FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uSunColor;
uniform vec3 uSun;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec3 col = mix(uNadir, uHorizon, smoothstep(0.0, 0.6, vUv.y));
  col = mix(col, uZenith, smoothstep(0.55, 1.05, vUv.y));
  vec2 d = (vUv - uSun.xy) * vec2(uAspect, 1.0);
  float r2 = dot(d, d);
  col += uSunColor * uSun.z * (0.55 * exp(-r2 * 5.0) + 0.5 * exp(-r2 * 60.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Gradient sky behind everything, with the glow of the sun (a sprite, no post-processing). */
export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(ambience: Ambience) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    // The sun glows from the upper corner on its side of the scene.
    const side = Math.sin((ambience.sun.azimuth * Math.PI) / 180) < 0 ? 0.12 : 0.88;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(ambience.sky.zenith) },
        uHorizon: { value: new THREE.Color(ambience.sky.horizon) },
        uNadir: { value: new THREE.Color(ambience.sky.nadir) },
        uSunColor: { value: new THREE.Color(ambience.sun.color) },
        uSun: { value: new THREE.Vector3(side, 1.02, ambience.sun.glow) },
        uAspect: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  setAspect(aspect: number): void {
    this.material.uniforms.uAspect.value = aspect;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

interface Cloud {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  speed: number;
}

/** KayKit clouds drifting around and below the floating diorama. */
export class Clouds {
  readonly meshes: THREE.InstancedMesh[] = [];
  private readonly clouds: Cloud[][] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly span: number;

  constructor(
    assets: AssetLibrary,
    material: THREE.Material,
    seed: number,
    counts: { cloud_big: number; cloud_small: number },
    radius: number,
  ) {
    const rng = new Rng(seed).fork('clouds');
    this.span = radius * 3.2;
    const models = ['cloud_big', 'cloud_small'] as const;
    models.forEach((model, m) => {
      const n = counts[model];
      const list: Cloud[] = [];
      for (let i = 0; i < n; i++) {
        // Behind and beside the diorama, a few low ones in front below the rim.
        const back = rng.chance(0.75);
        list.push({
          x: rng.range(-this.span / 2, this.span / 2),
          y: back ? rng.range(-9, 9) : rng.range(-16, -9),
          z: back
            ? rng.range(-radius * 2.6, -radius * 1.15)
            : rng.range(-radius * 0.6, radius * 0.9),
          scale: rng.range(2.2, 4.6) * (m === 0 ? 1 : 0.8),
          yaw: rng.range(0, Math.PI * 2),
          speed: rng.range(0.25, 0.6),
        });
      }
      const mesh = new THREE.InstancedMesh(assets.geometry(model), material, n);
      mesh.frustumCulled = false;
      mesh.name = model;
      this.meshes.push(mesh);
      this.clouds.push(list);
    });
    this.update(0);
  }

  update(time: number): void {
    const up = THREE.Object3D.DEFAULT_UP;
    this.meshes.forEach((mesh, m) => {
      const list = this.clouds[m];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const travelled = c.x + time * c.speed + this.span / 2;
        const x = (((travelled % this.span) + this.span) % this.span) - this.span / 2;
        this.position.set(x, c.y + Math.sin(time * 0.2 + i) * 0.3, c.z);
        this.quaternion.setFromAxisAngle(up, c.yaw);
        this.scale.set(c.scale, c.scale * 0.8, c.scale);
        this.matrix.compose(this.position, this.quaternion, this.scale);
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
  }
}
