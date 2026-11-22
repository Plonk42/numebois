import { Rng } from '../../core/rng';
import type { SoundLevels } from '../render/richness';

export type SoundState = 'waiting' | 'playing' | 'paused' | 'muted';

const MUTED_KEY = 'numebois.muted';
const NOISE_SECONDS = 3;
const FADE_SECONDS = 1.5;
/** Overall volume: an ambience stays in the background. */
const MASTER = 0.5;

interface Layer {
  gain: GainNode;
  /** Gain of the layer at level 1. */
  scale: number;
}

/**
 * Ambient sound synthesised from filtered noise (Web Audio). The noise buffer is white, so
 * its loop has no audible seam; filters and slow oscillators give it its colour and life.
 * Nothing plays before the first touch (browser rule), while the tab is hidden or when muted.
 */
export class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Record<keyof SoundLevels, Layer> | null = null;
  private levels: SoundLevels = { wind: 0, water: 0 };
  private touched = false;
  private hidden = false;
  private mutedValue: boolean;

  constructor() {
    this.mutedValue = localStorage.getItem(MUTED_KEY) === '1';
    window.addEventListener('pointerdown', this.onFirstTouch);
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  get state(): SoundState {
    if (this.mutedValue) return 'muted';
    if (!this.touched) return 'waiting';
    return this.hidden ? 'paused' : 'playing';
  }

  /** State of the audio context, for the tests ('none' before the first touch). */
  get contextState(): AudioContextState | 'none' {
    return this.context?.state ?? 'none';
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    // Unmuting is a touch too: it may start the sound.
    if (!muted) this.touched = true;
    this.update();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.update();
  }

  /** Volumes of the painting's stage; they glide to the new values. */
  setLevels(levels: SoundLevels): void {
    this.levels = levels;
    if (!this.context || !this.layers) return;
    const now = this.context.currentTime;
    for (const key of Object.keys(levels) as (keyof SoundLevels)[]) {
      const layer = this.layers[key];
      layer.gain.gain.setTargetAtTime(levels[key] * layer.scale, now, FADE_SECONDS / 3);
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onFirstTouch);
    void this.context?.close();
    this.context = null;
  }

  private readonly onFirstTouch = () => {
    window.removeEventListener('pointerdown', this.onFirstTouch);
    this.touched = true;
    this.update();
  };

  private update(): void {
    const play = this.state === 'playing';
    if (play && !this.context) this.build();
    const context = this.context;
    if (!context || !this.master) return;
    const now = context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    if (play) {
      void context.resume();
      this.master.gain.setTargetAtTime(MASTER, now, FADE_SECONDS / 3);
    } else {
      this.master.gain.setValueAtTime(0, now);
      void context.suspend();
    }
  }

  private build(): void {
    const context = new AudioContext();
    this.context = context;
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    this.master = master;

    const buffer = context.createBuffer(
      2,
      Math.round(context.sampleRate * NOISE_SECONDS),
      context.sampleRate,
    );
    const rng = new Rng(17);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = rng.next() * 2 - 1;
    }
    const noise = (offset: number) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.start(0, offset);
      return source;
    };
    const lfo = (frequency: number, depth: number, target: AudioParam) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      const amount = context.createGain();
      amount.gain.value = depth;
      oscillator.connect(amount).connect(target);
      oscillator.start();
    };
    const filter = (type: BiquadFilterType, frequency: number, q: number) => {
      const node = context.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = q;
      return node;
    };

    // Wind: deep noise whose colour and loudness swell in slow, irregular gusts.
    const windTone = filter('lowpass', 420, 0.8);
    const windBody = filter('lowpass', 900, 0.5);
    const windSwell = context.createGain();
    windSwell.gain.value = 0.7;
    lfo(0.071, 0.25, windSwell.gain);
    lfo(0.113, 0.15, windSwell.gain);
    lfo(0.053, 220, windTone.frequency);
    const wind = context.createGain();
    noise(0).connect(windTone).connect(windBody).connect(windSwell).connect(wind).connect(master);

    // Water from afar: a band of brighter noise with a quick, shallow burble.
    const waterBand = filter('bandpass', 1400, 0.6);
    const waterFar = filter('lowpass', 2600, 0.5);
    const burble = context.createGain();
    burble.gain.value = 0.85;
    lfo(6.3, 0.08, burble.gain);
    lfo(0.09, 0.08, burble.gain);
    const water = context.createGain();
    noise(NOISE_SECONDS / 2)
      .connect(waterBand)
      .connect(waterFar)
      .connect(burble)
      .connect(water)
      .connect(master);

    this.layers = { wind: { gain: wind, scale: 0.9 }, water: { gain: water, scale: 0.7 } };
    wind.gain.value = this.levels.wind * this.layers.wind.scale;
    water.gain.value = this.levels.water * this.layers.water.scale;
  }
}
