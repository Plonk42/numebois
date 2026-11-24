import * as THREE from 'three';
import { swatchColor, swatchUV } from '../atlas';
import { createNoiseTexture } from './noise';

/** Uniforms shared by every material of a scene, updated once per frame. */
export interface SharedUniforms {
  uTime: { value: number };
  uWindDir: { value: THREE.Vector2 };
  /** 0 disables the wind (low quality). */
  uWindStrength: { value: number };
}

interface Patch {
  key: string;
  uniforms: Record<string, THREE.IUniform>;
  vertexHeader?: string;
  /** Replaces `begin_vertex` (must declare `transformed`). */
  beginVertex?: string;
  /** Replaces `project_vertex` (must declare `mvPosition` and set `gl_Position`). */
  projectVertex?: string;
  /** Runs after `uv_vertex`. */
  uvVertex?: string;
  fragmentHeader?: string;
  /** Replaces `map_fragment`. */
  mapFragment?: string;
  /** Runs after `emissivemap_fragment`. */
  emissiveFragment?: string;
}

function patch<T extends THREE.Material>(material: T, p: Patch): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, p.uniforms);
    let vs = shader.vertexShader;
    if (p.vertexHeader)
      vs = vs.replace('#include <common>', `#include <common>\n${p.vertexHeader}`);
    if (p.beginVertex) vs = vs.replace('#include <begin_vertex>', p.beginVertex);
    if (p.projectVertex) vs = vs.replace('#include <project_vertex>', p.projectVertex);
    if (p.uvVertex) vs = vs.replace('#include <uv_vertex>', `#include <uv_vertex>\n${p.uvVertex}`);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    if (p.fragmentHeader) {
      fs = fs.replace('#include <common>', `#include <common>\n${p.fragmentHeader}`);
    }
    if (p.mapFragment) fs = fs.replace('#include <map_fragment>', p.mapFragment);
    if (p.emissiveFragment) {
      fs = fs.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${p.emissiveFragment}`,
      );
    }
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => p.key;
  return material;
}

/** Night veil (#85): share of the lit colours turned to a moonlit blue grey; set by the painting. */
export const nightVeil = { value: 0 };

// Light given off (windows) keeps its colour under the veil.
const NIGHT_VEIL = /* glsl */ `
{
  vec3 reflected = outgoingLight - totalEmissiveRadiance;
  float grey = dot(reflected, vec3(0.3, 0.59, 0.11));
  outgoingLight = mix(reflected, grey * vec3(0.68, 0.84, 1.32), uNightVeil) + totalEmissiveRadiance;
}
#include <opaque_fragment>
`;

/** The lit material takes the night veil, on top of its own patch. */
export function veiled<T extends THREE.Material>(material: T): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uNightVeil = nightVeil;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNightVeil;')
      .replace('#include <opaque_fragment>', NIGHT_VEIL);
  };
  material.customProgramCacheKey = () => `${key()}|veil`;
  return material;
}

// The windows of the buildings: the black of the Medieval Hexagon pack, copied to the darkest
// part of `DarkBark` (`HEX_ALIASES`), which nothing else of the scenery uses.
const [WINDOW_U, WINDOW_V0] = swatchUV('DarkBark', 0.9);
const WINDOW_V1 = swatchUV('DarkBark', 1)[1];
const WINDOW_GLOW = /* glsl */ `
#ifdef USE_MAP
  if (abs(vMapUv.x - ${WINDOW_U.toFixed(6)}) < 0.001
      && vMapUv.y > ${(WINDOW_V0 - 0.001).toFixed(6)} && vMapUv.y < ${(WINDOW_V1 + 0.001).toFixed(6)}) {
    totalEmissiveRadiance += uWindowGlow;
  }
#endif
`;

// Trees: growth by age and wind, from per-vertex attributes and a per-tree data texture
// (row 0: origin and age; row 1: stretch and phase).
const TREE_HEADER = /* glsl */ `
attribute vec3 aPivot;
attribute vec4 aGrow;
attribute float aTree;
uniform highp sampler2D uTreeData;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;

vec3 growTree(vec3 p) {
  int index = int(floor(aTree + 0.0005));
  vec4 d0 = texelFetch(uTreeData, ivec2(index, 0), 0);
  vec4 d1 = texelFetch(uTreeData, ivec2(index, 1), 0);
  float age = d0.w;
  float g = clamp((age - aGrow.x) / max(aGrow.y - aGrow.x, 0.004), 0.0, 1.0);
  p = mix(aPivot, p, g);
  float size = (0.5 + 0.5 * age) * min(1.0, age * 20.0);
  vec3 rel = (p - d0.xyz) * size;
  float stretch = d1.x;
  float thin = inversesqrt(stretch);
  rel *= vec3(thin, stretch, thin);
  float phase = d1.y;
  float gust = 0.5 + 0.5 * sin(dot(d0.xz, uWindDir) * 0.3 - uTime * 0.8 + phase);
  float sway = sin(uTime * 1.25 + phase * 6.283) * 0.6 + sin(uTime * 2.05 + phase * 4.1) * 0.4;
  float bend = aGrow.z * uWindStrength * (0.25 + 0.75 * gust);
  rel.xz += uWindDir * bend * (0.55 + 0.45 * sway) * 0.42;
  float wp = fract(aTree) * 6.283;
  rel += aGrow.w * uWindStrength * g * 0.07
    * vec3(sin(uTime * 2.3 + wp), 0.6 * sin(uTime * 1.7 + wp * 1.7), cos(uTime * 1.9 + wp));
  return d0.xyz + rel;
}
`;
const TREE_BEGIN = /* glsl */ `vec3 transformed = growTree(position);`;

// Instanced vegetation: bends from its base with gusts crossing the scene, and picks its
// colour column in the atlas per instance (seasons, petals).
const VEGETATION_HEADER = /* glsl */ `
attribute vec2 aSwatch;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;

vec2 vegetationWind(vec3 origin, float height) {
  float h = min(height, 1.6);
  float gust = sin(dot(origin.xz, uWindDir) * 0.45 - uTime * 1.4 + sin(origin.x * 0.31) * 1.7);
  float flutter = sin(uTime * 4.1 + origin.x * 3.3 + origin.z * 2.7);
  return uWindDir * (h * sqrt(h) * 0.2 * (0.55 + 0.45 * gust) + 0.035 * h * flutter) * uWindStrength;
}
`;
const VEGETATION_PROJECT = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelMatrix * mvPosition;
#ifdef USE_INSTANCING
  vec3 instanceOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  mvPosition.xz += vegetationWind(instanceOrigin, max(mvPosition.y - instanceOrigin.y, 0.0));
#endif
mvPosition = viewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
const VEGETATION_UV = /* glsl */ `
#ifdef USE_MAP
  vMapUv.x += uv.y < 0.25 ? aSwatch.x : (uv.y > 0.75 ? aSwatch.y : 0.0);
#endif
`;

// Water: opaque flat colours; ripples, streaks and foam move in the fragment shader.
// uv = (distance along the flow, position across), aWater = (kind, shore).
// Kinds: 0 still water, 1 stream, 2 waterfall.
const WATER_VERTEX_HEADER = /* glsl */ `
attribute vec2 aWater;
uniform float uTime;
uniform float uWave;
varying vec2 vFlow;
varying vec2 vWater;
varying vec3 vWorld;
`;
const WATER_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
vFlow = uv;
vWater = aWater;
if (aWater.x < 0.5) {
  transformed.y += uWave * 0.035 * (sin(position.x * 0.9 + uTime * 1.3) + sin(position.z * 1.3 - uTime * 1.1));
}
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const WATER_FRAGMENT_HEADER = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform vec3 uFoam;
uniform float uSparkle;
varying vec2 vFlow;
varying vec2 vWater;
varying vec3 vWorld;

float band(float edge, float x) {
  float w = fwidth(x) * 1.2 + 0.0005;
  return smoothstep(edge - w, edge + w, x);
}
`;
const WATER_MAP = /* glsl */ `
{
  float kind = vWater.x;
  float shore = vWater.y;
  float t = uTime;
  vec3 col;
  if (kind < 0.5) {
    vec2 p = vWorld.xz * 0.075;
    float n1 = texture2D(uNoise, p + vec2(t * 0.013, t * 0.009)).r;
    float n2 = texture2D(uNoise, p * 1.9 + vec2(-t * 0.011, t * 0.016)).g;
    float n = n1 * 0.6 + n2 * 0.4;
    col = mix(uDeep, uShallow, smoothstep(0.1, 0.85, shore + (n - 0.5) * 0.3));
    col = mix(col, uShallow, smoothstep(0.45, 0.8, n) * 0.22);
    float lines = band(0.61, n) - band(0.63, n);
    col = mix(col, uLight, lines * 0.3);
    float lap = 0.05 * sin(t * 1.2 + n1 * 6.283);
    col = mix(col, uFoam, band(0.84 + lap, shore + (n2 - 0.5) * 0.16));
  } else if (kind < 1.5) {
    vec2 p = vec2(vFlow.x * 0.22 - t * 0.33, vFlow.y * 0.55);
    float n1 = texture2D(uNoise, p).r;
    float n2 = texture2D(uNoise, p * vec2(0.6, 1.6) + vec2(-t * 0.1, 0.3)).g;
    float n = n1 * 0.55 + n2 * 0.45;
    col = mix(uDeep, uShallow, smoothstep(0.05, 0.9, shore * 0.8 + 0.25 + (n - 0.5) * 0.3));
    col = mix(col, uLight, band(0.62, n) * 0.7);
    col = mix(col, uFoam, band(0.8, shore + (n1 - 0.5) * 0.3));
  } else {
    vec2 p = vec2(vFlow.y * 0.9, vFlow.x * 0.16 - t * 0.85);
    float n1 = texture2D(uNoise, p).r;
    float n2 = texture2D(uNoise, p * vec2(2.1, 0.7) + vec2(0.2, -t * 0.4)).g;
    float n = n1 * 0.5 + n2 * 0.5;
    col = mix(uShallow, uLight, 0.4);
    col = mix(col, uFoam, band(0.5, n) * 0.85);
    col = mix(col, uFoam, band(0.72, shore + (n1 - 0.5) * 0.25));
  }
  float glint = texture2D(uNoise, vWorld.xz * 0.9 + vec2(t * 0.05)).r
    * texture2D(uNoise, vWorld.zx * 1.3 - vec2(t * 0.07)).g;
  col += uSparkle * vec3(1.0, 0.93, 0.7) * smoothstep(0.5, 0.56, glint);
  diffuseColor.rgb = col;
}
`;

export interface SceneMaterials {
  shared: SharedUniforms;
  /** Terrain, tiles, rocks, clouds: plain atlas colours. */
  solid: THREE.MeshLambertMaterial;
  vegetation: THREE.MeshLambertMaterial;
  tree: THREE.MeshLambertMaterial;
  treeDepth: THREE.MeshDepthMaterial;
  water: THREE.MeshLambertMaterial;
  waterUniforms: {
    uWave: { value: number };
    uSparkle: { value: number };
    uDeep: { value: THREE.Color };
    uShallow: { value: THREE.Color };
    uLight: { value: THREE.Color };
    uFoam: { value: THREE.Color };
  };
  treeData: { value: THREE.Texture | null };
  /** Light given off by the windows of the buildings (black by day). */
  windowGlow: { value: THREE.Color };
  dispose(): void;
}

export function paletteColor(...args: Parameters<typeof swatchColor>): THREE.Color {
  const [r, g, b] = swatchColor(...args);
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

export function createMaterials(atlas: THREE.Texture, seed: number): SceneMaterials {
  const shared: SharedUniforms = {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.86, 0.5) },
    uWindStrength: { value: 1 },
  };
  const treeData = { value: null as THREE.Texture | null };
  const noise = createNoiseTexture(seed);
  const waterUniforms = {
    uWave: { value: 1 },
    uSparkle: { value: 0 },
    uDeep: { value: paletteColor('HexWater', 0.3) },
    uShallow: { value: paletteColor('HexWaterLight', 0.1) },
    uLight: { value: paletteColor('HexCloud', 0.2) },
    uFoam: { value: new THREE.Color(1, 1, 1) },
  };

  const windowGlow = { value: new THREE.Color(0, 0, 0) };
  const solid = patch(new THREE.MeshLambertMaterial({ map: atlas }), {
    key: 'solid',
    uniforms: { uWindowGlow: windowGlow },
    fragmentHeader: 'uniform vec3 uWindowGlow;',
    emissiveFragment: WINDOW_GLOW,
  });
  const vegetation = patch(new THREE.MeshLambertMaterial({ map: atlas }), {
    key: 'vegetation',
    uniforms: shared as unknown as Record<string, THREE.IUniform>,
    vertexHeader: VEGETATION_HEADER,
    projectVertex: VEGETATION_PROJECT,
    uvVertex: VEGETATION_UV,
  });
  const treePatch: Patch = {
    key: 'tree',
    uniforms: { ...shared, uTreeData: treeData } as unknown as Record<string, THREE.IUniform>,
    vertexHeader: TREE_HEADER,
    beginVertex: TREE_BEGIN,
  };
  const tree = patch(new THREE.MeshLambertMaterial({ map: atlas }), treePatch);
  const treeDepth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), {
    ...treePatch,
    key: 'tree-depth',
  });
  const water = patch(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), {
    key: 'water',
    uniforms: {
      uTime: shared.uTime,
      uNoise: { value: noise },
      ...waterUniforms,
    },
    vertexHeader: WATER_VERTEX_HEADER,
    beginVertex: WATER_BEGIN,
    fragmentHeader: WATER_FRAGMENT_HEADER,
    mapFragment: WATER_MAP,
  });

  return {
    shared,
    solid: veiled(solid),
    vegetation: veiled(vegetation),
    tree: veiled(tree),
    treeDepth,
    water: veiled(water),
    waterUniforms,
    treeData,
    windowGlow,
    dispose() {
      for (const m of [solid, vegetation, tree, treeDepth, water]) m.dispose();
      noise.dispose();
    },
  };
}
