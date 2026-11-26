import type { GaugeExercise } from './gauges';
import type { DrawExercise, MeasureExercise } from './generators';

/** 1: the 0 on an end, then the other end read; 2: where the end falls, or the lengths added. */
export function measureHint({ level, lengths, unit }: MeasureExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
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
