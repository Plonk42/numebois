import { Rng } from '../../core/rng';
import type { SoundLevels } from '../render/richness';
import { SOUND_CATALOG, type CallName, type LoopName, type SoundName } from './sound-catalog';
import { SOUND_FILES } from './sounds.gen';

export type SoundState = 'waiting' | 'playing' | 'paused' | 'muted';

const MUTED_KEY = 'numebois.muted';
const NOISE_SECONDS = 3;
const FADE_SECONDS = 1.5;
/** Overall volume: an ambience stays in the background. */
const MASTER = 0.5;
/** Share of it kept during a question: low and continuous, nothing that distracts. */
const QUIET = 0.6;
const WIND_SCALE = 0.9;
/** Gain of each recorded loop at level 1 (the files share one loudness). */
const LOOP_SCALE: Record<LoopName, number> = {
  pond: 0.8,
  brook: 0.8,
  falls: 0.8,
  birds: 0.9,
  chorus: 0.7,
  meadow: 0.8,
  leaves: 0.8,
  crickets: 0.6,
};
type CallLevel = 'songs' | 'woodpecker' | 'cuckoo' | 'owl' | 'magic';
/** Recordings of each kind of call, and their gain. */
const CALLS: Record<CallLevel, { sounds: readonly CallName[]; gain: number }> = {
  songs: { sounds: ['chaffinch', 'blackbird', 'blackbird'], gain: 0.35 },
  woodpecker: { sounds: ['woodpecker'], gain: 0.35 },
  cuckoo: { sounds: ['cuckoo'], gain: 0.3 },
  owl: { sounds: ['owl'], gain: 0.4 },
  magic: { sounds: ['chimes'], gain: 0.25 },
};
/** Moments of the game that a short sound rewards. */
export type Reward = 'right' | 'seed' | 'element' | 'stage' | 'finale';
/** Recordings of each reward, one drawn each time, and its gain: the right answer comes often, so it stays soft. */
const REWARDS: Record<Reward, { sounds: readonly CallName[]; gain: number }> = {
  right: { sounds: ['ding', 'bell'], gain: 0.35 },
  seed: { sounds: ['seed'], gain: 0.55 },
  element: { sounds: ['chime', 'heal'], gain: 0.6 },
  stage: { sounds: ['stage'], gain: 0.6 },
  finale: { sounds: ['finale', 'jingle'], gain: 0.7 },
};
/** Never two calls of a kind closer than this, in seconds. */
const MIN_CALL_GAP = 6;
/** A touched tree: a bird sings in it, louder than the calls, one song at a time (seconds). */
const SONG_GAIN = 0.5;
const SONG_GAP = 2.5;

export type Family = 'air' | 'water' | 'birds' | 'insects';
const FAMILIES: readonly Family[] = ['air', 'water', 'birds', 'insects'];
const FAMILY: Record<'wind' | LoopName, Family> = {
  wind: 'air',
  leaves: 'air',
  pond: 'water',
  brook: 'water',
  falls: 'water',
  birds: 'birds',
  chorus: 'birds',
  meadow: 'insects',
  crickets: 'insects',
};
/** Time each family spends in front, in seconds. */
const TURN_SECONDS = 40;
/** Volume of a family while the others are in front. */
const BACKGROUND = 0.4;

/**
 * Families of loops take turns in front, so a rich stage never piles every layer up at
 * once: a family swells for about TURN_SECONDS, then steps back to BACKGROUND.
 */
export function familyWeights(levels: SoundLevels, time: number): Record<Family, number> {
  const keys = Object.keys(FAMILY) as (keyof typeof FAMILY)[];
  const active = FAMILIES.filter((f) => keys.some((k) => FAMILY[k] === f && levels[k] > 0));
  const period = TURN_SECONDS * active.length;
  const weights = { air: 0, water: 0, birds: 0, insects: 0 };
  active.forEach((family, i) => {
    const front = 0.5 + 0.5 * Math.cos(2 * Math.PI * (time / period - i / active.length));
    weights[family] = active.length < 2 ? 1 : BACKGROUND + (1 - BACKGROUND) * front;
  });
  return weights;
}

/**
 * Ambient sound in layers (Web Audio): wind synthesised from filtered noise, recorded loops
 * (water, birds, insects, leaves) whose volumes follow the stage, and calls played at
 * random moments, panned left or right. Nothing plays before the first touch (browser
 * rule), while the tab is hidden or when muted.
 */
export class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Rewards skip the master: a question lowers the ambience, never them. */
  private rewards: GainNode | null = null;
  private wind: GainNode | null = null;
  private readonly families = new Map<Family, GainNode>();
  private readonly loops = new Map<LoopName, GainNode>();
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly nextCall = new Map<CallLevel, number>();
  private songUntil = 0;
  private readonly rng = new Rng(29);
  private timer = 0;
  private levels: SoundLevels | null = null;
  private wasQuiet = false;
  private touched = false;
  private hidden = false;
  private mutedValue: boolean;
  /** True while a question is on screen (set by the game). */
  quiet: () => boolean = () => false;

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

  /** Recordings decoded so far, for the tests. */
  get loaded(): number {
    return this.buffers.size;
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

  /** Volumes and rates of the painting's stage; volumes glide to the new values. */
  setLevels(levels: SoundLevels): void {
    this.levels = levels;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.wind?.gain.setTargetAtTime(levels.wind * WIND_SCALE, now, FADE_SECONDS / 3);
    for (const [name, gain] of this.loops) {
      gain.gain.setTargetAtTime(levels[name] * LOOP_SCALE[name], now, FADE_SECONDS / 3);
    }
    this.nextCall.clear();
  }

  /** Rewards played so far, for the tests. */
  readonly played: Reward[] = [];

  /** Short sound of a reward: never skipped while the sound plays, even during a question. */
  reward(kind: Reward): void {
    if (this.state !== 'playing' || !this.rewards) return;
    const { sounds, gain } = REWARDS[kind];
    this.play(this.rng.pick(sounds), gain, this.rng.range(-0.3, 0.3), this.rewards);
    this.played.push(kind);
  }

  /** A bird sings in the plant the child touched (#28), panned from -1 (left) to 1 (right). */
  song(pan: number): void {
    const context = this.context;
    if (this.state !== 'playing' || !context || context.currentTime < this.songUntil) return;
    this.songUntil = context.currentTime + SONG_GAP;
    this.play(this.rng.pick(CALLS.songs.sounds), SONG_GAIN, Math.max(-0.8, Math.min(0.8, pan)));
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onFirstTouch);
    window.clearInterval(this.timer);
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
      this.master.gain.setTargetAtTime(this.volume(), now, FADE_SECONDS / 3);
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
    const rewards = context.createGain();
    rewards.gain.value = MASTER;
    rewards.connect(context.destination);
    this.rewards = rewards;
    for (const family of FAMILIES) {
      const gain = context.createGain();
      gain.connect(master);
      this.families.set(family, gain);
    }
    this.buildWind(context, this.families.get('air')!);
    for (const name of Object.keys(SOUND_CATALOG) as SoundName[]) void this.load(context, name);
    this.timer = window.setInterval(this.tick, 500);
  }

  // Wind: deep noise whose colour and loudness swell in slow, irregular gusts. The noise
  // buffer is white, so its loop has no audible seam.
  private buildWind(context: AudioContext, master: GainNode): void {
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
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    const lfo = (frequency: number, depth: number, target: AudioParam) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      const amount = context.createGain();
      amount.gain.value = depth;
      oscillator.connect(amount).connect(target);
      oscillator.start();
    };
    const filter = (frequency: number, q: number) => {
      const node = context.createBiquadFilter();
      node.type = 'lowpass';
      node.frequency.value = frequency;
      node.Q.value = q;
      return node;
    };
    const tone = filter(420, 0.8);
    const body = filter(900, 0.5);
    const swell = context.createGain();
    swell.gain.value = 0.7;
    lfo(0.071, 0.25, swell.gain);
    lfo(0.113, 0.15, swell.gain);
    lfo(0.053, 220, tone.frequency);
    const wind = context.createGain();
    wind.gain.value = (this.levels?.wind ?? 0) * WIND_SCALE;
    source.connect(tone).connect(body).connect(swell).connect(wind).connect(master);
    this.wind = wind;
  }

  private async load(context: AudioContext, name: SoundName): Promise<void> {
    try {
      const response = await fetch(import.meta.env.BASE_URL + SOUND_FILES[name].file);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (this.context !== context || !this.master) return;
      this.buffers.set(name, buffer);
      if (SOUND_CATALOG[name].kind === 'loop') this.startLoop(context, name as LoopName, buffer);
    } catch (error) {
      // Offline before the first visit cached them: the painting stays with the wind.
      console.warn(`Son ${name} indisponible`, error);
    }
  }

  private startLoop(context: AudioContext, name: LoopName, buffer: AudioBuffer): void {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = (this.levels?.[name] ?? 0) * LOOP_SCALE[name];
    source.connect(gain).connect(this.families.get(FAMILY[name])!);
    // Each loop starts somewhere else, so their seams never line up.
    source.start(0, this.rng.range(0, buffer.duration));
    this.loops.set(name, gain);
  }

  private play(name: CallName, gain: number, pan: number, output = this.master): void {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !buffer || !output) return;
    const cuts = SOUND_FILES[name].cuts;
    const [start, duration] = cuts[this.rng.int(0, cuts.length - 1)];
    const source = context.createBufferSource();
    source.buffer = buffer;
    const volume = context.createGain();
    volume.gain.value = gain;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(volume).connect(panner).connect(output);
    source.start(0, start, duration);
  }

  private volume(): number {
    return this.wasQuiet ? MASTER * QUIET : MASTER;
  }

  /** Calls of the stage at random moments, about `rate` a minute each; none during a question. */
  private readonly tick = () => {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.levels) return;
    const now = context.currentTime;
    const quiet = this.quiet();
    const weights = familyWeights(this.levels, now);
    for (const [family, gain] of this.families) {
      gain.gain.setTargetAtTime(weights[family], now, 3);
    }
    if (quiet !== this.wasQuiet) {
      this.wasQuiet = quiet;
      this.master?.gain.setTargetAtTime(this.volume(), now, FADE_SECONDS / 3);
    }
    if (quiet) {
      this.nextCall.clear();
      return;
    }
    for (const level of Object.keys(CALLS) as CallLevel[]) {
      const rate = this.levels[level];
      if (rate <= 0) continue;
      const mean = 60 / rate;
      const next = this.nextCall.get(level);
      if (next === undefined) {
        this.nextCall.set(level, now + this.rng.range(1, mean));
        continue;
      }
      if (now < next) continue;
      const { sounds, gain } = CALLS[level];
      this.play(this.rng.pick(sounds), gain, this.rng.range(-0.8, 0.8));
      this.nextCall.set(level, now + Math.max(MIN_CALL_GAP, -mean * Math.log(1 - this.rng.next())));
    }
  };
}
