import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { GAUGE_LEVELS, gaugeLures, generateGauge } from './gauges';
import { gaugeHint } from './hints';

const SEEDS = 1000;

describe('lire une graduation', () => {
  it.each(Array.from({ length: GAUGE_LEVELS }, (_, level) => level))(
    'level %i: 1 000 seeds, the needle or the liquid on a tick',
    (level) => {
      let unlabelled = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = generateGauge(new Rng(seed), level);
        const { figure, value, step, label } = exercise;
        if (figure?.kind !== 'gauge') throw new Error('figure');
        expect(figure.value).toBe(value);
        expect(value % step).toBe(0);
        expect(value > 0 && value < figure.max).toBe(true);
        expect(figure.max % label).toBe(0);
        expect(label % step).toBe(0);
        expect(exercise.answer).toBe(String(value));
        if (value % label !== 0) unlabelled++;
        // The worked hint counts the ticks from the number below.
        expect(gaugeHint(exercise, 2)).toContain(`${value} ${exercise.unit}`);
        expect(gaugeLures(exercise)).not.toContain(value);
      }
      // Mostly where the ticks have to be counted.
      if (level > 0) expect(unlabelled).toBeGreaterThan(SEEDS * 0.7);
    },
  );
});
