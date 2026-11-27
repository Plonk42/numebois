import * as THREE from 'three';
import type { ModelName } from '../asset-catalog';
import type { AssetLibrary } from '../assets';
import { CELL_U, swatchColumn, swatchUV, type SwatchName } from '../atlas';
import { paletteColor } from './materials';
import type { Stage } from './stage';

// The tree of what is known by heart (#151) drawn with the models and colours of the landscape,
// as images for the interface: the wood once per tree, the tufts of the facts once for all.

/** A piece of wood: points (x, y in the picture, y down; z towards the eye) and radii. */
export interface WoodPiece {
  points: [number, number, number][];
  radii: number[];
  /** Ridges of the bark, from 0 (smooth) to about 0.1 (an old trunk). */
  rough: number;
}

/** The tufts a fact grows, a few turns of each, and the tufts that carry the names. */
export interface TuftSprites {
  bud: string[];
  young: string[];
  grown: string[];
  bloom: string[];
  label: string;
  labelBloom: string;
}

/** Seen a little from above, like the painting. */
const PITCH = (14 * Math.PI) / 180;
const TAU = Math.PI * 2;

/** The world point drawn at (x, y) of a picture `height` high, `z` towards the camera. */
function at(height: number, x: number, y: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(x, (height - y + z * Math.sin(PITCH)) / Math.cos(PITCH), z);
}

function lights(scene: THREE.Scene): void {
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3);
  sun.position.set(-3, 5, 4);
  scene.add(sun, new THREE.HemisphereLight(0xf2f6ff, 0x7a9a5c, 1.6));
}

/** Orthographic camera on the picture `width × height`, centred on `centre`. */
function camera(centre: THREE.Vector3, width: number, height: number): THREE.OrthographicCamera {
  const view = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.01,
    4000,
  );
  view.position
    .copy(centre)
    .addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 1500);
  view.lookAt(centre);
  view.updateProjectionMatrix();
  view.updateMatrixWorld();
  return view;
}

/** Everything made for one picture, freed once drawn. */
class Kit {
  private readonly owned: { dispose(): void }[] = [];
  readonly atlas: THREE.MeshLambertMaterial;

  constructor(readonly assets: AssetLibrary) {
    this.atlas = this.own(new THREE.MeshLambertMaterial({ map: assets.atlas }));
  }

  own<T extends { dispose(): void }>(thing: T): T {
    this.owned.push(thing);
    return thing;
  }

  flat(name: SwatchName, f: number): THREE.MeshLambertMaterial {
    return this.own(
      new THREE.MeshLambertMaterial({ color: paletteColor(name, f), flatShading: true }),
    );
  }

  /** A model of the pack, its foliage in the atlas column of `foliage`. */
  model(name: ModelName, width: number, foliage?: SwatchName): THREE.Mesh {
    let geometry = this.assets.geometry(name);
    if (foliage) {
      geometry = this.own(geometry.clone());
      const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + swatchColumn(foliage) * CELL_U);
    }
    const mesh = new THREE.Mesh(geometry, this.atlas);
    mesh.scale.setScalar(width / this.assets.size(name)[0]);
    return mesh;
  }

  dispose(): void {
    for (const thing of this.owned) thing.dispose();
  }
}

/**
 * A tube through the points in the bark gradient. `rough` carves ridges along it, slowly
 * twisting, the grooves darker.
 */
function tube(points: THREE.Vector3[], radii: number[], rough: number): THREE.BufferGeometry {
  const sides = radii[0] > 20 ? 16 : radii[0] > 9 ? 10 : 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const n = new THREE.Vector3();
  const s = new THREE.Vector3();
  const t = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let k = 0; k < points.length; k++) {
    t.subVectors(
      points[Math.min(points.length - 1, k + 1)],
      points[Math.max(0, k - 1)],
    ).normalize();
    if (k === 0) {
      n.set(0, 0, 1).cross(t).normalize();
      if (n.lengthSq() < 0.1) n.set(1, 0, 0);
    } else {
      n.addScaledVector(t, -n.dot(t)).normalize();
    }
    s.crossVectors(t, n);
    for (let i = 0; i < sides; i++) {
      const angle = (i * TAU) / sides + k * 0.06;
      o.copy(n).multiplyScalar(Math.cos(angle)).addScaledVector(s, Math.sin(angle));
      const groove = rough > 0 && i % 2 === 1;
      const wobble = Math.sin(k * 1.7 + i * 2.3) * 0.35;
      const r = radii[k] * (1 + rough * ((groove ? -1 : 0.5) + wobble));
      positions.push(points[k].x + o.x * r, points[k].y + o.y * r, points[k].z + o.z * r);
      uvs.push(...swatchUV('Bark', 0.3 + 0.5 * (1 - (o.y + 1) / 2) + (groove ? 0.2 : 0)));
    }
  }
  for (let k = 0; k < points.length - 1; k++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = k * sides + i;
      const b = k * sides + j;
      index.push(a, b, (k + 1) * sides + j, a, (k + 1) * sides + j, (k + 1) * sides + i);
    }
  }
  // A rounded end.
  const last = points.length - 1;
  const tip = points[last].clone().addScaledVector(t, radii[last] * 1.2);
  positions.push(tip.x, tip.y, tip.z);
  uvs.push(...swatchUV('Bark', 0.3));
  const top = positions.length / 3 - 1;
  for (let i = 0; i < sides; i++)
    index.push(last * sides + i, last * sides + ((i + 1) % sides), top);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The wood of a tree, `width × height` in CSS pixels, on a transparent background; with `ground`,
 * its roots go into a tuft of grass at the bottom of the picture.
 */
export function factTreeWood(
  stage: Stage,
  assets: AssetLibrary,
  wood: readonly WoodPiece[],
  width: number,
  height: number,
  ground: boolean,
): string {
  const kit = new Kit(assets);
  try {
    const scene = new THREE.Scene();
    lights(scene);
    const place = (x: number, y: number, z = 0) => at(height, x, y, z);
    for (const { points, radii, rough } of wood) {
      const geometry = kit.own(
        tube(
          points.map(([x, y, z]) => place(x, y, z)),
          radii,
          rough,
        ),
      );
      scene.add(new THREE.Mesh(geometry, kit.atlas));
    }
    if (ground) {
      const [fx] = wood[0].points[0];
      for (const [dx, dz, reach] of [
        [-1, 0.4, 96],
        [1, 0.3, 88],
        [-0.3, 1, 72],
        [0.5, 1, 66],
      ] as const) {
        const root = [
          place(fx, height - 40),
          place(fx + dx * reach * 0.6, height - 10, dz * 30),
          place(fx + dx * reach, height + 6, dz * 50),
        ];
        scene.add(new THREE.Mesh(kit.own(tube(root, [26, 14, 6], 0.08)), kit.atlas));
      }
      const grass = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(260, 250, 16, 24)), [
        kit.flat('Meadow', 0.25),
        kit.flat('Meadow', 0.25),
        kit.flat('Earth', 0.65),
      ]);
      grass.scale.z = 0.35;
      grass.position.copy(place(fx, height + 12));
      const bush = kit.model('Bush_1_B', 70);
      bush.position.copy(place(fx - 110, height, 30));
      const tuft = kit.model('Grass_1_A', 40);
      tuft.position.copy(place(fx + 90, height + 4, 40));
      tuft.rotation.y = 1.2;
      scene.add(grass, bush, tuft);
    }
    return stage.cutout(scene, camera(place(width / 2, height / 2), width, height), width, height);
  } finally {
    kit.dispose();
  }
}

/** Little flowers on the front of a tuft `width` wide, away from the middle if `rim`. */
function flowers(
  kit: Kit,
  group: THREE.Object3D,
  width: number,
  height: number,
  rim: boolean,
): void {
  const petal = [kit.flat('PetalWhite', 0.2), kit.flat('PetalPink', 0.2)];
  const heart = kit.flat('PetalYellow', 0.3);
  const ball = kit.own(new THREE.IcosahedronGeometry(1, 0));
  const spots = rim
    ? [
        [-0.36, 0.1],
        [0.34, 0.14],
        [-0.26, -0.2],
        [0.28, -0.18],
        [0.02, 0.26],
      ]
    : [
        [-0.25, 0.22],
        [0.22, 0.3],
        [0.3, -0.12],
        [-0.28, -0.18],
        [0.0, -0.02],
      ];
  for (const [i, [sx, sy]] of spots.entries()) {
    const flower = new THREE.Group();
    const r = width * 0.05;
    for (let p = 0; p < 5; p++) {
      const leaf = new THREE.Mesh(ball, petal[i % 2]);
      const a = (p * TAU) / 5;
      leaf.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 0);
      leaf.scale.setScalar(r);
      flower.add(leaf);
    }
    const middle = new THREE.Mesh(ball, heart);
    middle.scale.setScalar(r * 0.8);
    middle.position.z = r * 0.5;
    flower.add(middle);
    flower.position.set(sx * width, sy * height, width * 0.5);
    flower.rotation.x = -PITCH;
    group.add(flower);
  }
}

/** The tufts of the facts and of the names, each on a transparent background. */
export function factTreeTufts(stage: Stage, assets: AssetLibrary): TuftSprites {
  const kit = new Kit(assets);
  try {
    const scene = new THREE.Scene();
    lights(scene);
    const draw = (
      object: THREE.Object3D,
      width: number,
      height: number,
      size: [number, number],
    ) => {
      scene.add(object);
      const url = stage.cutout(scene, camera(new THREE.Vector3(), width, height), ...size);
      scene.remove(object);
      return url;
    };
    const turns = [0.3, 1.9, 3.7];
    const tuft = (name: ModelName, swatch: SwatchName, yaw: number, bloom: boolean) => {
      const group = new THREE.Group();
      const mesh = kit.model(name, 1, swatch);
      mesh.rotation.y = yaw;
      group.add(mesh);
      if (bloom) flowers(kit, group, 1, 0.78, false);
      return group;
    };
    const square = (object: THREE.Object3D) => draw(object, 1.12, 1.12, [72, 72]);
    const bud = (yaw: number) => {
      const group = tuft('Tuft_RoundSmall', 'Spring', yaw, false);
      group.scale.set(0.62, 0.95, 0.62);
      return square(group);
    };
    const label = (bloom: boolean) => {
      const group = new THREE.Group();
      const mesh = kit.model('Tuft_Round', 1, 'Spring');
      mesh.rotation.y = 0.8;
      group.add(mesh);
      group.scale.set(1.5, 0.95, 1);
      if (bloom) flowers(kit, group, 1, 0.78, true);
      return draw(group, 1.7, 1.1, [170, 110]);
    };
    return {
      bud: turns.map(bud),
      young: turns.map((yaw) => square(tuft('Tuft_Round', 'Spring', yaw, false))),
      grown: turns.map((yaw) => square(tuft('Tuft_Round', 'Summer', yaw, false))),
      bloom: turns.map((yaw) => square(tuft('Tuft_Round', 'Summer', yaw, true))),
      label: label(false),
      labelBloom: label(true),
    };
  } finally {
    kit.dispose();
  }
}
