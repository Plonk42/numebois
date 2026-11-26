import { RULER_BEFORE_MM, type Point, type Pose } from '../../core/sheet';
import type { Tried } from '../../core/types';
import type { GaugeExercise } from './gauges';
import type { DrawExercise, MeasureExercise } from './generators';

/** The 0 of the ruler jumps onto an end when close: this close, it is on it (mm). */
const ZERO_ON_END_MM = 0.5;
/** The edge of the ruler (its body before the 0) this close to an end is laid on it (mm). */
const EDGE_ON_END_MM = 2.5;
/** The ruler turned this far from the segment (degrees) is not along it. */
const ALONG_DEGREES = 3;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** What went wrong with the ruler on a single segment, or null when it lay right (#167). */
function rulerSlip({ input }: MeasureExercise, ruler: Pose): string | null {
  if (input.kind !== 'ruler' || input.lines.length !== 1) return null;
  const [{ from, to }] = input.lines;
  const zero = [from, to].find((end) => distance(end, ruler) <= ZERO_ON_END_MM);
  if (!zero) {
    const rad = (ruler.angle * Math.PI) / 180;
    const edge = {
      x: ruler.x - RULER_BEFORE_MM * Math.cos(rad),
      y: ruler.y - RULER_BEFORE_MM * Math.sin(rad),
    };
    if ([from, to].some((end) => distance(end, edge) <= EDGE_ON_END_MM)) {
      return 'Le bord de la règle n’est pas le 0.\nPose le trait du 0 sur un bout.';
    }
    return 'Le 0 de la règle n’est sur aucun bout.\nGlisse-le sur un bout du segment.';
  }
  const other = zero === from ? to : from;
  const along = (Math.atan2(other.y - zero.y, other.x - zero.x) * 180) / Math.PI;
  const gap = Math.abs(((along - ruler.angle + 540) % 360) - 180);
  if (gap > ALONG_DEGREES) {
    return 'Ton 0 est bien posé.\nTourne la règle avec son rond, le long du segment.';
  }
  return null;
}

/** What the answer tells of the reading, or null when it is not a known mistake (#167). */
function readingSlip({ lengths, unit }: MeasureExercise, answer: number): string | null {
  if (lengths.length > 1) {
    const parts = lengths.map((n) => n / 10);
    const some = parts.flatMap((a, i) => [a, ...parts.slice(i + 1).map((b) => a + b)]);
    if (some.includes(answer)) {
      return 'C’est la longueur d’un seul segment.\nMesure les autres, puis ajoute.';
    }
    return null;
  }
  const [length] = lengths;
  if (unit === 'cm') {
    return answer === length ? 'Ici, on mesure en cm.\nLis le nombre sous l’autre bout.' : null;
  }
  const cm = Math.floor(length / 10);
  const mm = length % 10;
  if (answer === mm)
    return 'Tu as compté les petits traits.\nCompte d’abord les cm : 1 cm = 10 mm.';
  if (answer === cm) {
    return `${cm}, ce sont les cm.\nEn mm : 1 cm = 10 mm, puis les petits traits.`;
  }
  if (answer % 10 === mm) {
    return 'Les petits traits sont bons.\nRegarde le dernier nombre avant le bout.';
  }
  if (Math.abs(answer - length) <= 2) {
    return `Tu y es presque.\nRecompte les petits traits après le ${cm}.`;
  }
  return null;
}

/** The typical mistakes of a reading, as the hints recognise them (#167). */
export function measureLures({ lengths, unit, answer }: MeasureExercise): number[] {
  const right = Number(answer);
  let lures: number[];
  if (lengths.length > 1) lures = lengths.map((n) => n / 10);
  else if (unit === 'cm') lures = [lengths[0], right - 1, right + 1];
  else {
    const cm = Math.floor(right / 10);
    const mm = right % 10;
    lures = [mm, cm, 10 * (cm - 1) + mm, 10 * (cm + 1) + mm, right - 1, right + 2];
  }
  return [...new Set(lures)].filter((n) => n > 0 && n !== right);
}

/**
 * 1: about the mistake when it is recognised (the ruler, then the reading), else the 0 on an end
 * then the other end read; 2: where the end falls, or the lengths added.
 */
export function measureHint(exercise: MeasureExercise, attempt: 1 | 2, tried?: Tried): string {
  const { level, lengths, unit } = exercise;
  if (attempt === 1) {
    const slip =
      (tried?.ruler && rulerSlip(exercise, tried.ruler)) ||
      (tried && /^\d+$/.test(tried.answer) && readingSlip(exercise, Number(tried.answer)));
    if (slip) return slip;
    if (lengths.length > 1) return 'Mesure chaque segment, puis ajoute les longueurs.';
    const zero = level === 3 ? 'Tourne la règle avec son rond : le 0' : 'Le 0 de la règle';
    const read =
      unit === 'cm'
        ? 'Lis le trait de l’autre bout.'
        : 'Lis les cm, puis compte les petits traits.';
    return `${zero} sur un bout.\n${read}`;
  }
  if (lengths.length > 1) {
    const cm = lengths.map((n) => n / 10);
    return `${cm.join(' cm + ')} cm = ${cm.reduce((sum, n) => sum + n, 0)} cm.`;
  }
  const [length] = lengths;
  if (unit === 'cm')
    return `Le 0 sur un bout, l’autre bout sur le ${length / 10} : ${length / 10} cm.`;
  const cm = Math.floor(length / 10);
  const mm = length % 10;
  return `Le bout tombe ${mm} petits traits après le ${cm}.\n${cm} cm et ${mm} mm : ${length} mm.`;
}

/** 1: the 0 on the point; 2: where to stop on the ruler. */
export function drawHint({ length }: DrawExercise, attempt: 1 | 2): string {
  if (attempt === 1) return 'Pose le 0 de la règle sur le point.\nPuis trace jusqu’au bon trait.';
  const cm = Math.floor(length / 10);
  const mm = length % 10;
  if (mm === 0) return `Arrête le trait sur le ${cm} de la règle.`;
  return `${length} mm, c’est ${cm} cm et ${mm} mm.\nArrête-toi ${mm} petits traits après le ${cm}.`;
}

/** 1: what a tick is worth; 2: the ticks counted from the number below. */
export function gaugeHint(
  { value, step, label, unit, instrument }: GaugeExercise,
  attempt: 1 | 2,
): string {
  const what = instrument === 'jug' ? 'Le liquide' : 'L’aiguille';
  if (attempt === 1) {
    if (step === label) return `${what} est sur un nombre : lis-le.`;
    return `Entre deux nombres, chaque trait vaut ${step} ${unit}.`;
  }
  const below = Math.floor(value / label) * label;
  const ticks = (value - below) / step;
  if (ticks === 0) return `${what} est sur ${value} : ${value} ${unit}.`;
  const counted = `${ticks} trait${ticks > 1 ? 's' : ''}`;
  return `${what} est ${counted} après ${below}.\n${below} + ${ticks * step} = ${value} ${unit}.`;
}
