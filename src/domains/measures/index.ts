import { defineDomain } from '../../core/registry';
import { RULER_ZERO } from './lessons/ruler-zero';
import { draw, measure, readGauge } from './skills';

export const measures = defineDomain({
  id: 'measures',
  name: 'Les mesures',
  skills: [measure, draw, readGauge],
  lessons: [RULER_ZERO],
});
