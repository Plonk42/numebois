export type Quality = 'high' | 'medium' | 'low';
export const QUALITIES: readonly Quality[] = ['high', 'medium', 'low'];

/**
 * Behaviour of every effect at each quality tier. A new effect adds its field here, so its
 * medium and low behaviour is always declared.
 */
export interface QualitySettings {
  /** Cap of the device pixel ratio. */
  pixelRatio: number;
  /** Shadow map size, 0 for no cast shadows (contact shadows instead). */
  shadowMapSize: number;
  /** The shadow map is refreshed every n frames. */
  shadowInterval: number;
  /** Dark discs under the trees, when cast shadows are off. */
  contactShadows: boolean;
  /** Wind in the vertex shaders (trees, vegetation). */
  wind: boolean;
  /** Vertex waves on still water (colours, streaks and foam always move). */
  waterWaves: boolean;
  /** Factor on ambient particle counts (pollen, leaves, fireflies, foam, butterflies). */
  particles: number;
  /** Sun ray sprites. */
  sunRays: boolean;
  /** Factor on the number of drifting clouds. */
  clouds: number;
  /** Factor on grass and flower density. */
  groundCover: number;
  /** Growth and reward effects are never cut: always 1. */
  growthFx: 1;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadowInterval: 1,
    contactShadows: false,
    wind: true,
    waterWaves: true,
    particles: 1,
    sunRays: true,
    clouds: 1,
    groundCover: 1,
    growthFx: 1,
  },
  medium: {
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    shadowInterval: 2,
    contactShadows: false,
    wind: true,
    waterWaves: true,
    particles: 0.6,
    sunRays: true,
    clouds: 1,
    groundCover: 0.8,
    growthFx: 1,
  },
  low: {
    pixelRatio: 1,
    shadowMapSize: 0,
    shadowInterval: 1,
    contactShadows: true,
    wind: false,
    waterWaves: false,
    particles: 0.3,
    sunRays: false,
    clouds: 0.5,
    groundCover: 0.55,
    growthFx: 1,
  },
};

export function parseQuality(value: string | null): Quality | 'auto' {
  return QUALITIES.includes(value as Quality) ? (value as Quality) : 'auto';
}

/**
 * Automatic quality: starts high and steps down when the measured frame rate stays under
 * the target. It never steps back up, to avoid oscillating.
 */
export class QualityGovernor {
  private frames = 0;
  private elapsed = 0;
  private warmup = 45;

  constructor(
    public quality: Quality,
    private readonly onChange: (quality: Quality) => void,
    private readonly minFps = 40,
  ) {}

  /** Call once per rendered frame with the frame duration in seconds. */
  frame(dt: number): void {
    if (this.quality === 'low') return;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    // A long pause (tab hidden, debugger) is not a slow frame.
    if (dt > 0.5) return;
    this.frames++;
    this.elapsed += dt;
    if (this.frames < 90) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (fps < this.minFps) {
      this.quality = this.quality === 'high' ? 'medium' : 'low';
      this.warmup = 45;
      this.onChange(this.quality);
    }
  }
}
