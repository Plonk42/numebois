import { defineSkill } from '../../core/registry';
import { WRITE_DIGITS } from '../numbers/generators';
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
import { drawHint, measureHint } from './hints';
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
