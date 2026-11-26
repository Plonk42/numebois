/** A point of the sheet under the ruler, in millimetres from its top left corner. */
export interface Point {
  x: number;
  y: number;
}

/** A segment drawn on the sheet, in millimetres: its lengths are exact. */
export interface Segment {
  from: Point;
  to: Point;
}

/** Where the 0 of the ruler is on the sheet, and how it is turned (degrees, clockwise). */
export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** The sheet where segments are measured and drawn (#57), in millimetres. */
export const SHEET = { width: 168, height: 62 };
/** The ruler, graduated from 0 to 14 cm. */
export const RULER_MM = 140;
/** The body of the ruler goes on this far before its 0. */
export const RULER_BEFORE_MM = 6;
/** Where the segments lie, above the ruler at rest and right of its 0. */
export const DRAWING_AREA = { top: 6, bottom: 34, left: 10, right: 155 };
/** The ruler at rest, its 0 under the drawing area. */
export const RULER_REST_Y = 42;

export function segmentLength({ from, to }: Segment): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}
