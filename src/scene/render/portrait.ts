import * as THREE from 'three';
import type { AnimalName } from '../animal-catalog';
import type { AnimalLibrary } from '../animals';
import { ANIMALS } from '../animals.gen';
import { nightVeil } from './materials';
import type { Stage } from './stage';

/** Background of the portraits: the soft green of the shop's tiles. */
const BACKGROUND = 0xe6f2da;
const FOV = 30;

/** An animal of the pack, three-quarters front and slightly from above, as an image. */
export function animalPortrait(
  stage: Stage,
  library: AnimalLibrary,
  name: AnimalName,
  size: number,
): string {
  const body = library.create(name);
  body.pose('idle', 0.4, 1);
  body.apply();
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-2, 4, 3);
  scene.add(body.object, sun, new THREE.HemisphereLight(0xf2f6ff, 0x7a9a5c, 1.5));
  const { min, max } = ANIMALS[name];
  const center = new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  );
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  const distance = (0.85 * radius) / Math.sin((FOV * Math.PI) / 360);
  const camera = new THREE.PerspectiveCamera(FOV, 1, distance / 10, distance * 3);
  camera.position
    .copy(center)
    .addScaledVector(new THREE.Vector3(0.8, 0.35, 1).normalize(), distance);
  camera.lookAt(center);
  // The shop shows the animal in its colours, even at night.
  const veil = nightVeil.value;
  nightVeil.value = 0;
  const url = stage.snapshot(scene, camera, size, BACKGROUND);
  nightVeil.value = veil;
  body.dispose();
  return url;
}
