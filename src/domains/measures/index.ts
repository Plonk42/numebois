import { defineDomain } from '../../core/registry';
import { draw, measure, readGauge } from './skills';

export const measures = defineDomain({
  id: 'measures',
  name: 'Les mesures',
  skills: [measure, draw, readGauge],
});
