import { defineSkill } from '../../core/registry';
import { LINE_READ, WRITE_DIGITS } from '../numbers/generators';
import { GAUGE_LEVELS, READ_GAUGE, gaugeLures, generateGauge, type GaugeExercise } from './gauges';
import {
  DRAW,
  DRAW_LEVELS,
  MEASURE,
  MEASURE_LEVELS,
  generateDraw,
  generateMeasure,
  type DrawExercise,
  type MeasureExercise,
} from './generators';
import { drawHint, gaugeHint, measureHint } from './hints';
import { validateDrawing, validateMeasure } from './validate';

export const measure = defineSkill<MeasureExercise>({
  id: MEASURE,
  name: 'Mesurer à la règle',
  prerequisites: [WRITE_DIGITS],
  levels: MEASURE_LEVELS,
  generate: generateMeasure,
  validate: validateMeasure,
  hint: measureHint,
});

export const draw = defineSkill<DrawExercise>({
  id: DRAW,
  name: 'Tracer à la règle',
  prerequisites: [MEASURE],
  levels: DRAW_LEVELS,
  generate: generateDraw,
  validate: validateDrawing,
  hint: drawHint,
});

export const readGauge = defineSkill<GaugeExercise>({
  id: READ_GAUGE,
  name: 'Lire une balance, un verre doseur',
  prerequisites: [LINE_READ],
  levels: GAUGE_LEVELS,
  generate: generateGauge,
  validate: validateMeasure,
  hint: gaugeHint,
  lures: gaugeLures,
});
