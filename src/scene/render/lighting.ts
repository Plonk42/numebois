import * as THREE from 'three';
import type { QualitySettings } from './quality';
import type { Ambience } from './richness';

export function sunDirection(ambience: Ambience, target = new THREE.Vector3()): THREE.Vector3 {
  const az = (ambience.sun.azimuth * Math.PI) / 180;
  const el = (ambience.sun.elevation * Math.PI) / 180;
  return target.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Hemisphere light and one sun with soft shadows limited to the diorama. */
export class Lighting {
  readonly hemisphere: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private frame = 0;

  constructor(
    ambience: Ambience,
    center: THREE.Vector3,
    radius: number,
    private readonly quality: QualitySettings,
  ) {
    this.hemisphere = new THREE.HemisphereLight(
      ambience.hemisphere.sky,
      ambience.hemisphere.ground,
      ambience.hemisphere.intensity,
    );
    this.sun = new THREE.DirectionalLight(ambience.sun.color, ambience.sun.intensity);
    const direction = sunDirection(ambience);
    this.sun.position.copy(center).addScaledVector(direction, radius * 2.5);
    this.sun.target.position.copy(center);
    if (quality.shadowMapSize > 0) {
      this.sun.castShadow = true;
      const shadow = this.sun.shadow;
      shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      const camera = shadow.camera;
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
      camera.near = radius * 0.5;
      camera.far = radius * 4.5;
      camera.updateProjectionMatrix();
      shadow.bias = -0.0006;
      shadow.normalBias = 0.06;
      shadow.radius = ambience.shadow.blur;
      shadow.intensity = ambience.shadow.strength;
    }
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.hemisphere, this.sun, this.sun.target);
  }

  /** Refresh the shadow map only every few frames on lower tiers. */
  beforeRender(renderer: THREE.WebGLRenderer): void {
    if (this.quality.shadowMapSize === 0) return;
    renderer.shadowMap.autoUpdate = false;
    if (this.frame++ % this.quality.shadowInterval === 0) renderer.shadowMap.needsUpdate = true;
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.hemisphere.dispose();
    this.sun.dispose();
  }
}
