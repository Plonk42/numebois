import * as THREE from 'three';
import type { ModelName } from '../asset-catalog';
import type { AssetLibrary } from '../assets';
import { Rng } from '../../core/rng';
import { paletteColor } from './materials';
import type { Stage } from './stage';

/** An image with a transparent background, in CSS pixels. */
export interface Sprite {
  url: string;
  width: number;
  height: number;
}

export type StoneState = 'ahead' | 'here' | 'crossed';

/**
 * The trail drawn as a tiny diorama of the forest, at its size between two trails; during a
 * trail, it shows `1 / TRAIL_ZOOM` as big, at the same place.
 */
export interface TrailArt {
  /** The strip of land: grass for the sign, then the dirt path to the tree at the end. */
  path: Sprite;
  /** Where each stone sits on the strip, in CSS pixels from its top left corner. */
  stones: readonly (readonly [number, number])[];
  /** A stepping stone, centred on its place. */
  stone: Record<StoneState, Sprite>;
  /** The wooden sign at the start of the path: where it goes on the strip, where its words go. */
  sign: Sprite & {
    left: number;
    top: number;
    /** The foot of its post, on the sprite. */
    foot: readonly [number, number];
    label: { x: number; y: number; width: number; height: number };
  };
  /** The stump of the drill (« Rafale »), on its own tuft of grass, and where its word goes. */
  stump: Sprite & { label: { x: number; y: number; width: number; height: number } };
}

/** CSS pixels per world unit of the art: its size at the bottom of the screen. */
export const TRAIL_ZOOM = 1.35;

// Spacing of the stones, in world units (CSS pixels during a trail).
const FIRST = 30;
const GAP = 46;
const TO_TREE = 42;
/** Grass left of the start of the path, for the sign, and where its post stands there (x, z). */
const SIGN_ROOM = 127;
const POST_AT = [63, 8] as const;
/** Seen from the front and above, like the painting. */
const PITCH = (56 * Math.PI) / 180;
const DEPTH = 40;
const THICKNESS = 16;
const TOP = 36;
const BOTTOM = 29;
const STONE_BOX = 40;

/** The path winds gently through the grass. */
const wind = (x: number) => 5.5 * Math.sin(x / 34);

function lights(scene: THREE.Scene): void {
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3);
  sun.position.set(-3, 5, 4);
  scene.add(sun, new THREE.HemisphereLight(0xf2f6ff, 0x7a9a5c, 1.6));
}

/** Orthographic camera from the front and above, `left`…`right` × `bottom`…`top` around `at`. */
function camera(
  at: THREE.Vector3,
  pitch: number,
  yaw: number,
  box: [number, number, number, number],
) {
  const [left, right, top, bottom] = box;
  const view = new THREE.OrthographicCamera(left, right, top, -bottom, 1, 2000);
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );
  view.position.copy(at).addScaledVector(dir, 800);
  view.lookAt(at);
  view.updateProjectionMatrix();
  view.updateMatrixWorld();
  return view;
}

class Kit {
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  readonly atlas: THREE.MeshLambertMaterial;

  constructor(readonly assets: AssetLibrary) {
    this.atlas = this.material({ map: assets.atlas });
  }

  material(params: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
    const material = new THREE.MeshLambertMaterial(params);
    this.materials.push(material);
    return material;
  }

  flat(color: THREE.Color): THREE.MeshLambertMaterial {
    return this.material({ color, flatShading: true });
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]): THREE.Mesh {
    this.geometries.push(geometry);
    return new THREE.Mesh(geometry, material);
  }

  model(name: ModelName, scale: number, x: number, y: number, z: number, yaw = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(this.assets.geometry(name), this.atlas);
    mesh.scale.setScalar(scale);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    return mesh;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** A flat rounded tile in the ground plane, `thickness` deep under y = 0. */
function tile(
  width: number,
  depth: number,
  radius: number,
  thickness: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = width / 2;
  const d = depth / 2;
  shape.moveTo(-w + radius, -d);
  shape.lineTo(w - radius, -d);
  shape.quadraticCurveTo(w, -d, w, -d + radius);
  shape.lineTo(w, d - radius);
  shape.quadraticCurveTo(w, d, w - radius, d);
  shape.lineTo(-w + radius, d);
  shape.quadraticCurveTo(-w, d, -w, d - radius);
  shape.lineTo(-w, -d + radius);
  shape.quadraticCurveTo(-w, -d, -w + radius, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1.5,
    bevelSegments: 2,
    curveSegments: 5,
  });
  // The shape lies in x/z, extruded downwards.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, -1, 0);
  return geometry;
}

/** A ribbon along the winding path, `width` wide, `lift` above the ground. */
function ribbon(length: number, width: number, lift: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = Math.ceil(length / 4);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * length;
    const z = wind(x);
    positions.push(x, lift, z - width / 2, x, lift, z + width / 2);
    if (i > 0) {
      const a = 2 * i - 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A layer of grass over a block of earth, like a tile of the painting, `width` long from x = 0. */
function land(kit: Kit, width: number): THREE.Mesh[] {
  const grass = kit.mesh(tile(width - 4, DEPTH, 16, 4), [
    kit.flat(paletteColor('Meadow', 0.25)),
    kit.flat(paletteColor('Meadow', 0.75)),
  ]);
  const earth = kit.mesh(tile(width - 8, DEPTH - 4, 14, THICKNESS - 2), [
    kit.flat(paletteColor('Earth', 0.7)),
    kit.flat(paletteColor('Earth', 0.6)),
  ]);
  grass.position.x = width / 2;
  earth.position.set(width / 2, -2, 0);
  return [grass, earth];
}

/** A piece of land `width` long seen like the painting, and where a point of its ground shows. */
function landSprite(stage: Stage, scene: THREE.Scene, width: number) {
  const at = new THREE.Vector3(width / 2, 0, 0);
  const view = camera(at, PITCH, 0, [-width / 2, width / 2, TOP, BOTTOM]);
  const size = [width * TRAIL_ZOOM, (TOP + BOTTOM) * TRAIL_ZOOM] as const;
  return {
    sprite: { url: stage.cutout(scene, view, ...size), width: size[0], height: size[1] },
    onLand: (x: number, z: number) =>
      [x * TRAIL_ZOOM, (TOP + z * Math.sin(PITCH)) * TRAIL_ZOOM] as const,
  };
}

/** A round patch flat on the ground, `lift` above it. */
function patch(kit: Kit, radius: number, lift: number, material: THREE.Material): THREE.Mesh {
  const mesh = kit.mesh(new THREE.CircleGeometry(radius, 16), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = lift;
  return mesh;
}

function pathSprite(stage: Stage, kit: Kit, stones: number) {
  const tree = FIRST + (stones - 1) * GAP + TO_TREE;
  const width = SIGN_ROOM + tree + 28;
  const scene = new THREE.Scene();
  lights(scene);
  // What follows the path is placed from its start, after the grass of the sign.
  const path = new THREE.Group();
  path.position.x = SIGN_ROOM;
  // The dirt path, its rim a little wider and darker, from a round start to the tree.
  const rim = kit.flat(paletteColor('Earth', 0.35));
  const soil = kit.flat(paletteColor('Earth', 0.08));
  path.add(
    kit.mesh(ribbon(tree, 24, 0.3), rim),
    kit.mesh(ribbon(tree, 18, 0.6), soil),
    patch(kit, 12, 0.3, rim),
    patch(kit, 9, 0.6, soil),
  );
  scene.add(...land(kit, width), path);

  // Grass, flowers and a few bushes along both edges, away from the path, the same for a length.
  const rng = new Rng(stones * 7919 + 13);
  const flower = new THREE.IcosahedronGeometry(2.4, 0);
  kit.geometries.push(flower);
  const petals = (['PetalPink', 'PetalYellow', 'PetalWhite', 'PetalViolet'] as const).map((p) =>
    kit.flat(paletteColor(p, 0.25)),
  );
  for (let x = 8 - SIGN_ROOM; x < tree + 20; x += 6 + rng.next() * 6) {
    for (const side of [-1, 1]) {
      if (rng.next() < 0.3) continue;
      // The sign hides the back of its grass.
      if (side < 0 && x < 12) continue;
      const z = wind(Math.max(x, 0)) + side * (14 + rng.next() * 5);
      if (Math.abs(z) > DEPTH / 2 - 2.5 || Math.abs(x - tree) < 16) continue;
      const roll = rng.next();
      if (roll < 0.22) {
        const bloom = new THREE.Mesh(flower, petals[Math.floor(rng.next() * petals.length)]);
        bloom.position.set(x, 2.2, z);
        path.add(bloom);
        continue;
      }
      let name: ModelName = 'Grass_1_A';
      let scale = 13 + rng.next() * 5;
      if (roll < 0.32) {
        name = 'Bush_1_B';
        scale = 12 + rng.next() * 5;
      } else if (roll < 0.38) {
        name = 'Rock_1_A';
        scale = 6 + rng.next() * 3;
      } else if (roll < 0.65) {
        name = 'Grass_2_B';
        scale = 9 + rng.next() * 3;
      }
      path.add(kit.model(name, scale, x, 0, z, rng.next() * Math.PI * 2));
    }
  }

  // The tree at the end of the path: the end is always in sight.
  const tz = wind(tree) - 4;
  const trunk = kit.mesh(
    new THREE.CylinderGeometry(2.4, 3.6, 20, 6),
    kit.flat(paletteColor('DarkBark', 0.45)),
  );
  trunk.position.set(tree, 10, tz);
  path.add(
    trunk,
    kit.model('Tuft_Round', 9.5, tree, 28, tz, 0.6),
    kit.model('Tuft_RoundSmall', 12, tree - 9, 21, tz + 3, 1.7),
    kit.model('Tuft_RoundSmall', 11, tree + 9, 22, tz + 1, 2.9),
    kit.model('Bush_1_B', 13, tree + 8, 0, tz + 9, 0.8),
  );

  const { sprite, onLand } = landSprite(stage, scene, width);
  return {
    path: sprite,
    stones: Array.from({ length: stones }, (_, i) =>
      onLand(SIGN_ROOM + FIRST + i * GAP, wind(FIRST + i * GAP)),
    ),
    stand: onLand(...POST_AT),
  };
}

function stoneSprites(stage: Stage, kit: Kit): Record<StoneState, Sprite> {
  const looks: Record<StoneState, THREE.Material> = {
    ahead: kit.atlas,
    here: kit.material({
      color: paletteColor('PetalYellow', 0.15),
      emissive: paletteColor('PetalYellow', 0.4),
      emissiveIntensity: 0.35,
      flatShading: true,
    }),
    crossed: kit.material({
      color: paletteColor('Meadow', 0.1),
      emissive: paletteColor('Meadow', 0.3),
      emissiveIntensity: 0.25,
      flatShading: true,
    }),
  };
  const sprites = {} as Record<StoneState, Sprite>;
  for (const state of ['ahead', 'here', 'crossed'] as const) {
    const scene = new THREE.Scene();
    lights(scene);
    const stone = new THREE.Mesh(kit.assets.geometry('Rock_3_E'), looks[state]);
    stone.scale.set(14, 5, 12);
    stone.position.y = 2;
    scene.add(stone);
    const half = STONE_BOX / 2;
    const view = camera(new THREE.Vector3(), PITCH, 0, [-half, half, half, half]);
    const size = STONE_BOX * TRAIL_ZOOM;
    sprites[state] = {
      url: stage.cutout(scene, view, size, size),
      width: size,
      height: size,
    };
  }
  return sprites;
}

// The sign, in world units: two light planks nailed on two posts, cut together as an arrow
// pointing along the path, a line of its name on each.
const BOARD_W = 108;
const BOARD_TIP = 16;
const BOARD_H = 42;
/** Half the gap between the planks, their bevel included. */
const PLANK_GAP = 1.8;
const LEGS = 11;
const FOOT_X = BOARD_W / 2;
const POSTS = [14, BOARD_W - 12] as const;
const SIGN_PITCH = (14 * Math.PI) / 180;
const SIGN_BOX: [number, number, number, number] = [-70, 70, 33, 29];

/** A plank of the board between two heights, its right end cut along the point of the arrow. */
function plankShape(from: number, to: number, slant: number): THREE.Shape {
  const end = (y: number) => BOARD_W + BOARD_TIP * (1 - Math.abs((2 * y) / BOARD_H - 1));
  const shape = new THREE.Shape();
  shape.moveTo(slant, from);
  shape.lineTo(end(from), from);
  shape.lineTo(end(to), to);
  shape.lineTo(-slant, to);
  shape.closePath();
  return shape;
}

/** The sign, its foot at `stand` on the strip. */
function signSprite(stage: Stage, kit: Kit, stand: readonly [number, number]): TrailArt['sign'] {
  const scene = new THREE.Scene();
  lights(scene);
  // Pale wood, a little brighter than the light makes it: the words must read at a glance.
  const pale = paletteColor('Brown', 0).lerp(paletteColor('Birch', 0), 0.2);
  const wood = [
    kit.material({ color: pale, emissive: pale, emissiveIntensity: 0.45, flatShading: true }),
    kit.flat(paletteColor('Brown', 0.62)),
  ];
  const grain = kit.flat(paletteColor('Brown', 0.3));
  const dark = kit.flat(paletteColor('DarkBark', 0.42));
  const nail = kit.flat(paletteColor('DarkBark', 0.9));
  const half = BOARD_H / 2;
  // Each plank a little askew, with its own cut on the left and a few lines of grain clear
  // of the words (from its centre: x, y, length).
  const planks = [
    { from: 0, to: half - PLANK_GAP, slant: 2.5, shift: 2, turn: -0.005, lines: [[60, 3, 9]] },
    {
      from: half + PLANK_GAP,
      to: BOARD_H,
      slant: -2,
      shift: -2,
      turn: 0.013,
      lines: [
        [-45, 3, 8],
        [-41, -3, 5],
        [47, -2, 10],
      ],
    },
  ];
  for (const { from, to, slant, shift, turn, lines } of planks) {
    const middle = (from + to) / 2;
    const geometry = new THREE.ExtrudeGeometry(plankShape(from, to, slant), {
      depth: 3,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 1,
    });
    geometry.translate(-FOOT_X, -middle, 0);
    const plank = new THREE.Group();
    plank.position.set(FOOT_X + shift, LEGS + middle, 0);
    plank.rotation.z = turn;
    plank.add(kit.mesh(geometry, wood));
    for (const [x, y, length] of lines) {
      const line = kit.mesh(new THREE.BoxGeometry(length, 0.7, 0.4), grain);
      line.position.set(x, y, 4);
      plank.add(line);
    }
    // A nail into each post, at the outer edge of the board.
    for (const x of POSTS) {
      const head = kit.mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.8, 6), nail);
      head.rotation.x = Math.PI / 2;
      head.position.set(x - FOOT_X - shift, Math.sign(middle - half) * (to - middle - 3.2), 4.2);
      plank.add(head);
    }
    scene.add(plank);
  }
  // The posts stand behind the board, their pointed tops just over it.
  const height = LEGS + BOARD_H + 1;
  for (const x of POSTS) {
    const post = kit.mesh(new THREE.CylinderGeometry(3.4, 4, height, 6), dark);
    post.position.set(x, height / 2, -4);
    const top = kit.mesh(new THREE.ConeGeometry(4, 3.5, 6), dark);
    top.position.set(x, height + 1.75, -4);
    scene.add(post, top);
  }
  // Grass and flowers at its feet, leaves over a corner: it has stood there for a while.
  const flowers = [
    ['PetalPink', POSTS[0] + 13, 4],
    ['PetalYellow', POSTS[1] - 11, 3],
    ['PetalWhite', POSTS[0] + 19, 1],
  ] as const;
  for (const [petal, x, z] of flowers) {
    const bloom = kit.mesh(
      new THREE.IcosahedronGeometry(2.2, 0),
      kit.flat(paletteColor(petal, 0.25)),
    );
    bloom.position.set(x, 2, z);
    scene.add(bloom);
  }
  scene.add(
    kit.model('Grass_2_B', 15, POSTS[0] - 6, 0, 2, 0.4),
    kit.model('Grass_1_A', 17, POSTS[0] + 6, 0, 3, 2.1),
    kit.model('Grass_1_A', 15, POSTS[1] + 6, 0, 2, 1.1),
    kit.model('Rock_1_A', 7, POSTS[1] - 5, 0, 0, 1.2),
    kit.model('Tuft_RoundSmall', 17, POSTS[0] - 10, LEGS + BOARD_H - 3, 5, 0.8),
    kit.model('Tuft_RoundSmall', 12, POSTS[0] - 15, LEGS + BOARD_H - 9, 5, 2.3),
  );
  // Faces the camera: the words written over the planks stay square with them.
  const center = new THREE.Vector3((BOARD_W + BOARD_TIP) / 2, (LEGS + BOARD_H) / 2, 0);
  const view = camera(center, SIGN_PITCH, 0, SIGN_BOX);
  const width = (SIGN_BOX[1] - SIGN_BOX[0]) * TRAIL_ZOOM;
  const tall = (SIGN_BOX[2] + SIGN_BOX[3]) * TRAIL_ZOOM;
  const url = stage.cutout(scene, view, width, tall);
  const place = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).project(view);
    return [((p.x + 1) / 2) * width, ((1 - p.y) / 2) * tall] as const;
  };
  // The front of the board, short of the tip: a line of the name on each plank.
  const [left, top] = place(2, LEGS + BOARD_H, 4);
  const [right, bottom] = place(BOARD_W + 4, LEGS, 4);
  const foot = place(FOOT_X, 0, -4);
  return {
    url,
    width,
    height: tall,
    left: stand[0] - foot[0],
    top: stand[1] - foot[1],
    foot,
    label: { x: left, y: top, width: right - left, height: bottom - top },
  };
}

// The stump of the drill, in world units: a mossy stump on a round tuft of grass, a small
// plank with its word leaning on its front.
const STUMP_PITCH = (30 * Math.PI) / 180;
const STUMP_BOX: [number, number, number, number] = [-62, 62, 62, 30];
const STUMP_PLANK = [58, 19] as const;

function stumpSprite(stage: Stage, kit: Kit): TrailArt['stump'] {
  const scene = new THREE.Scene();
  lights(scene);
  const grass = kit.mesh(tile(118, 60, 28, 6), [
    kit.flat(paletteColor('Meadow', 0.25)),
    kit.flat(paletteColor('Earth', 0.65)),
  ]);
  scene.add(
    grass,
    kit.model('Stump_Moss', 66, 0, 0, -8, 0.5),
    kit.model('Grass_1_A', 16, -44, 0, 6, 0.4),
    kit.model('Grass_2_B', 12, 46, 0, 2, 2.2),
    kit.model('Grass_1_A', 14, 40, 0, -16, 1.3),
    kit.model('Rock_1_A', 7, -46, 0, -12, 0.9),
  );
  for (const [petal, x, z] of [
    ['PetalPink', -36, 18],
    ['PetalYellow', 36, 18],
  ] as const) {
    const bloom = kit.mesh(
      new THREE.IcosahedronGeometry(2.2, 0),
      kit.flat(paletteColor(petal, 0.25)),
    );
    bloom.position.set(x, 2, z);
    scene.add(bloom);
  }
  // Pale wood, like the sign of the trail, facing the camera.
  const pale = paletteColor('Brown', 0).lerp(paletteColor('Birch', 0), 0.2);
  const [width, height] = STUMP_PLANK;
  const edge = kit.flat(paletteColor('Brown', 0.62));
  const face = kit.material({
    color: pale,
    emissive: pale,
    emissiveIntensity: 0.45,
    flatShading: true,
  });
  // Box faces: ±x, ±y, then +z, the front, and -z.
  const plank = kit.mesh(new THREE.BoxGeometry(width, height, 3), [
    edge,
    edge,
    edge,
    edge,
    face,
    edge,
  ]);
  const front = new THREE.Group();
  front.position.set(0, height / 2 + 2, 26);
  front.rotation.x = -0.3;
  front.add(plank);
  scene.add(front);
  const view = camera(new THREE.Vector3(0, 16, 0), STUMP_PITCH, 0, STUMP_BOX);
  const w = (STUMP_BOX[1] - STUMP_BOX[0]) * TRAIL_ZOOM;
  const h = (STUMP_BOX[2] + STUMP_BOX[3]) * TRAIL_ZOOM;
  const url = stage.cutout(scene, view, w, h);
  scene.updateMatrixWorld();
  const place = (x: number, y: number) => {
    const p = new THREE.Vector3(x, y, 1.5).applyMatrix4(front.matrixWorld).project(view);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h] as const;
  };
  const [left, top] = place(-width / 2, height / 2);
  const [right, bottom] = place(width / 2, -height / 2);
  return {
    url,
    width: w,
    height: h,
    label: { x: left, y: top, width: right - left, height: bottom - top },
  };
}

/** Draws the trail of `stones` stones and its sign with the models and colours of the forest. */
export function trailArt(stage: Stage, assets: AssetLibrary, stones: number): TrailArt {
  const kit = new Kit(assets);
  try {
    const { stand, ...strip } = pathSprite(stage, kit, stones);
    return {
      ...strip,
      stone: stoneSprites(stage, kit),
      sign: signSprite(stage, kit, stand),
      stump: stumpSprite(stage, kit),
    };
  } finally {
    kit.dispose();
  }
}
