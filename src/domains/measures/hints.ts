import type { DrawExercise, MeasureExercise } from './generators';

/** 1: where to set the ruler; 2: where the end falls, or the lengths added. */
export function measureHint({ level, lengths, unit }: MeasureExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    if (lengths.length > 1) return 'Mesure chaque segment, puis ajoute les longueurs.';
    if (level === 3) return 'Tourne la règle avec son rond.\nLe 0 sur un bout du segment.';
    return 'Glisse la règle : son 0 sur un bout du segment.';
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
