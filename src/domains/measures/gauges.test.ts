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

describe('lire une graduation : indices après une erreur (#168)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });
  const scale = {
    ...generateGauge(new Rng(1), 3),
    value: 350,
    step: 50,
    label: 100,
    unit: 'g',
    instrument: 'scale' as const,
  };
  const method = 'Entre deux nombres, chaque trait vaut 50 g.';

  it('a tick off, 1 per tick, the next number', () => {
    expect(gaugeHint(scale, 1, tried(400))).toBe(`Tu es à un trait près.\n${method}`);
    expect(gaugeHint(scale, 1, tried(301))).toBe(`Tu as compté 1 par trait.\n${method}`);
    expect(gaugeHint(scale, 1, tried(450))).toBe(
      'Pars du nombre juste avant l’aiguille.\nChaque trait vaut 50 g.',
    );
    expect(gaugeHint({ ...scale, instrument: 'jug' }, 1, tried(450))).toContain(
      'juste sous le liquide',
    );
    expect(gaugeHint(scale, 1, tried(600))).toBe(method);
  });

  it.each(Array.from({ length: GAUGE_LEVELS }, (_, level) => level))(
    'level %i: every lure is a recognised mistake',
    (level) => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = generateGauge(new Rng(seed), level);
        for (const lure of gaugeLures(exercise)) {
          if (lure < 0) continue;
          expect(gaugeHint(exercise, 1, tried(lure)), `${exercise.value} → ${lure}`).not.toBe(
            gaugeHint(exercise, 1),
          );
        }
      }
    },
  );
});
