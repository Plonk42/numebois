/** How far the child may explore around the framing (#72): degrees, and zoom factor. */
export const EXPLORE_LIMITS = { yaw: 35, pitch: 8, zoom: 2.5 } as const;

/** Offsets from the framing: degrees, zoom factor, move of the aim on the ground (units). */
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  x: number;
  z: number;
}

export const HOME_VIEW: Readonly<View> = { yaw: 0, pitch: 0, zoom: 1, x: 0, z: 0 };

const KEYS = ['yaw', 'pitch', 'zoom', 'x', 'z'] as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Keeps a view in its limits. The aim moves in an ellipse of the painting (half extents
 * `half`) that shrinks to nothing at the framing: zoomed out, the whole painting is in view.
 */
export function clampView(view: View, half: readonly [number, number]): View {
  const { yaw, pitch, zoom } = EXPLORE_LIMITS;
  const z = clamp(view.zoom, 1, zoom);
  const room = 1 - 1 / z;
  const ax = half[0] * room;
  const az = half[1] * room;
  const r = ax > 0 && az > 0 ? Math.hypot(view.x / ax, view.z / az) : Infinity;
  const shrink = r > 1 ? 1 / r : 1;
  return {
    yaw: clamp(view.yaw, -yaw, yaw),
    pitch: clamp(view.pitch, -pitch, pitch),
    zoom: z,
    x: Number.isFinite(r) ? view.x * shrink : 0,
    z: Number.isFinite(r) ? view.z * shrink : 0,
  };
}

/**
 * A view given as shares of its limits, for captures (`?view=yaw,pitch,zoom,x,z`): -1 to 1,
 * zoom from 0 (framing) to 1; the aim as a share of its room at that zoom.
 */
export function viewFromShares(shares: readonly number[], half: readonly [number, number]): View {
  const [yaw = 0, pitch = 0, zoom = 0, x = 0, z = 0] = shares.map((s) => clamp(s, -1, 1));
  const factor = 1 + (EXPLORE_LIMITS.zoom - 1) * Math.max(0, zoom);
  const room = 1 - 1 / factor;
  return clampView(
    {
      yaw: yaw * EXPLORE_LIMITS.yaw,
      pitch: pitch * EXPLORE_LIMITS.pitch,
      zoom: factor,
      x: x * half[0] * room,
      z: z * half[1] * room,
    },
    half,
  );
}

export function parseViewShares(text: string | null): number[] | null {
  if (!text) return null;
  const shares = text.split(',').map(Number);
  return shares.every(Number.isFinite) ? shares : null;
}

/** What the gestures need to know of the camera: radians, and world units per CSS pixel. */
export interface Lens {
  yaw: number;
  pitch: number;
  unitsPerPixel: number;
}

/** Gesture gains: degrees per pixel (mouse, two fingers sliding), zoom per wheel step. */
const YAW_PER_PX = 0.25;
const PITCH_PER_PX = 0.12;
const WHEEL = 0.0015;
/** Time constants of the glide: following a gesture, coming back to the framing (seconds). */
const FOLLOW_S = 0.08;
const HOME_S = 0.4;
/** A touch that hardly moves is a tap, however long it lasts (CSS pixels). */
const TAP_PX = 12;

/**
 * Gestures over the forest: one finger moves the view, two fingers pinch to zoom, twist to
 * turn and slide up or down to tilt (mouse: drag, right drag, wheel); a tap goes to `onTap`.
 * Off, the view glides back to the framing and gestures do nothing.
 */
export class Explorer {
  readonly view: View = { ...HOME_VIEW };
  /** A tap while gestures are on, in CSS pixels from the top left of the element. */
  onTap: ((x: number, y: number) => void) | null = null;
  /** Just before a gesture or a jump moves the view: the stage folds its orbit into it. */
  beforeMove: (() => void) | null = null;
  private goal: View = { ...HOME_VIEW };
  private half: [number, number] = [0, 0];
  private enabled = false;
  private homing = false;
  private away = false;
  private last = performance.now();
  private onAway: ((away: boolean) => void) | null = null;
  private readonly pointers = new Map<number, { x: number; y: number; button: number }>();
  /** The pointer that may still be a tap, and where it went down. */
  private tap: { id: number; x: number; y: number } | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly lens: () => Lens,
  ) {
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    element.addEventListener('pointerup', this.up);
    element.addEventListener('pointercancel', this.up);
    element.addEventListener('wheel', this.wheel, { passive: false });
    element.addEventListener('contextmenu', this.menu);
  }

  get active(): boolean {
    return this.enabled;
  }

  /** The view is at the framing, or gliding back to it: the whole painting. */
  get atHome(): boolean {
    return !this.away;
  }

  /** The view has arrived where it goes: nothing glides. */
  get settled(): boolean {
    return KEYS.every((key) => this.view[key] === this.goal[key]);
  }

  /** Where the view goes once the glide is over. */
  get destination(): Readonly<View> {
    return this.goal;
  }

  /** Gestures on, with a callback told when the view leaves or comes back to the framing. */
  enable(onAway: (away: boolean) => void = () => undefined): void {
    this.enabled = true;
    this.onAway = onAway;
  }

  /** Gestures off: the view glides back to the framing. */
  disable(): void {
    this.enabled = false;
    this.onAway = null;
    this.pointers.clear();
    this.tap = null;
    this.recenter();
  }

  recenter(): void {
    this.goal = { ...HOME_VIEW };
    this.homing = true;
    this.notify();
  }

  /** Half extents of the painting, in which the aim moves. */
  setRoom(half: readonly [number, number]): void {
    this.half = [half[0], half[1]];
    this.goal = clampView(this.goal, this.half);
  }

  /** Jumps to a view without gliding (captures). */
  show(view: View): void {
    this.beforeMove?.();
    this.goal = clampView(view, this.half);
    Object.assign(this.view, this.goal);
    this.homing = false;
    this.notify();
  }

  /** Jumps to a view given as shares of the limits (`viewFromShares`). */
  showShares(shares: readonly number[]): void {
    this.show(viewFromShares(shares, this.half));
  }

  /** Turns the view and its goal together, in degrees, without gliding nor telling. */
  shift(yaw: number, pitch: number): void {
    this.view.yaw += yaw;
    this.view.pitch += pitch;
    this.goal = clampView(
      { ...this.goal, yaw: this.goal.yaw + yaw, pitch: this.goal.pitch + pitch },
      this.half,
    );
  }

  /** Glides the view towards its goal, on the clock of the page; once per frame. */
  step(): View {
    const now = performance.now();
    // Uncapped: the glide stays stable on slow frames and arrives on time.
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const k = 1 - Math.exp(-dt / (this.homing ? HOME_S : FOLLOW_S));
    let settled = true;
    for (const key of KEYS) {
      const gap = this.goal[key] - this.view[key];
      if (Math.abs(gap) > 1e-3) {
        settled = false;
        this.view[key] += gap * k;
      } else {
        this.view[key] = this.goal[key];
      }
    }
    if (settled) this.homing = false;
    return this.view;
  }

  dispose(): void {
    const element = this.element;
    element.removeEventListener('pointerdown', this.down);
    element.removeEventListener('pointermove', this.move);
    element.removeEventListener('pointerup', this.up);
    element.removeEventListener('pointercancel', this.up);
    element.removeEventListener('wheel', this.wheel);
    element.removeEventListener('contextmenu', this.menu);
  }

  private change(next: Partial<View>): void {
    const plain = clampView({ ...this.goal, ...next }, this.half);
    if (KEYS.every((key) => plain[key] === this.goal[key])) return;
    const before = { ...this.goal };
    this.beforeMove?.();
    const goal = { ...this.goal };
    for (const key of KEYS) {
      const value = next[key];
      if (value !== undefined) goal[key] = value + this.goal[key] - before[key];
    }
    this.goal = clampView(goal, this.half);
    this.homing = false;
    this.notify();
  }

  private notify(): void {
    const away = KEYS.some((key) => Math.abs(this.goal[key] - HOME_VIEW[key]) > 1e-3);
    if (away !== this.away) {
      this.away = away;
      this.onAway?.(away);
    }
  }

  private readonly down = (event: PointerEvent) => {
    if (!this.enabled || this.pointers.size >= 2) return;
    event.preventDefault();
    this.element.setPointerCapture?.(event.pointerId);
    this.tap =
      this.pointers.size === 0 && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
    });
  };

  private readonly move = (event: PointerEvent) => {
    const before = this.pointers.get(event.pointerId);
    if (!this.enabled || !before) return;
    event.preventDefault();
    const after = { x: event.clientX, y: event.clientY, button: before.button };
    const tap = this.tap;
    if (tap && Math.hypot(after.x - tap.x, after.y - tap.y) > TAP_PX) this.tap = null;
    if (this.pointers.size === 1) {
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      if (event.pointerType === 'mouse' && (before.button === 2 || event.shiftKey)) {
        this.change({
          yaw: this.goal.yaw - dx * YAW_PER_PX,
          pitch: this.goal.pitch + dy * PITCH_PER_PX,
        });
      } else {
        this.pan(dx, dy);
      }
    } else {
      const other = [...this.pointers].find(([id]) => id !== event.pointerId)![1];
      const d0 = Math.hypot(before.x - other.x, before.y - other.y);
      const d1 = Math.hypot(after.x - other.x, after.y - other.y);
      const a0 = Math.atan2(before.y - other.y, before.x - other.x);
      const a1 = Math.atan2(after.y - other.y, after.x - other.x);
      let turn = a1 - a0;
      if (turn > Math.PI) turn -= 2 * Math.PI;
      if (turn < -Math.PI) turn += 2 * Math.PI;
      // The middle of the two fingers slides half as far as the finger that moved.
      const slide = (after.y - before.y) / 2;
      this.change({
        zoom: d0 > 0 ? (this.goal.zoom * d1) / d0 : this.goal.zoom,
        yaw: this.goal.yaw + (turn * 180) / Math.PI,
        pitch: this.goal.pitch + slide * PITCH_PER_PX,
      });
    }
    this.pointers.set(event.pointerId, after);
  };

  private readonly up = (event: PointerEvent) => {
    const known = this.pointers.delete(event.pointerId);
    const tap = this.tap;
    if (!known || tap?.id !== event.pointerId) return;
    this.tap = null;
    if (event.type === 'pointerup' && this.enabled) {
      const box = this.element.getBoundingClientRect();
      this.onTap?.(tap.x - box.left, tap.y - box.top);
    }
  };

  private readonly wheel = (event: WheelEvent) => {
    if (!this.enabled) return;
    event.preventDefault();
    this.change({ zoom: this.goal.zoom * Math.exp(-event.deltaY * WHEEL) });
  };

  private readonly menu = (event: Event) => {
    if (this.enabled) event.preventDefault();
  };

  /** The ground follows the finger: across the screen, and along it foreshortened. */
  private pan(dx: number, dy: number): void {
    const { yaw, pitch, unitsPerPixel } = this.lens();
    const across = -dx * unitsPerPixel;
    const along = (dy * unitsPerPixel) / Math.max(0.2, Math.sin(pitch));
    // Right on the ground: (cos yaw, -sin yaw); away from the camera: (-sin yaw, -cos yaw).
    this.change({
      x: this.goal.x + across * Math.cos(yaw) - along * Math.sin(yaw),
      z: this.goal.z - across * Math.sin(yaw) - along * Math.cos(yaw),
    });
  }
}
