import { expect, test } from '@playwright/test';
import { skillsById } from '../../src/core/registry';
import { timeText } from '../../src/core/time';
import type { Exercise } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import type { ReadExercise } from '../../src/domains/fractions/generators';
import type { ReadClockExercise } from '../../src/domains/time/generators';
import { current, driver, expectSlateLayout } from './helpers';

/** Typical mistakes of a notion without lures. */
type Mistakes = (exercise: Exercise) => string[];

/** The hands read the other way round. */
const swappedHands: Mistakes = (exercise) => {
  const { hours, minutes } = exercise as ReadClockExercise;
  return [timeText({ hours: minutes / 5 || 12, minutes: 5 * (hours % 12) })];
};

/** The right calculation, one off. */
const offByOne: Mistakes = (exercise) => [String(Number(exercise.answer) + 1)];

/** The numbers of a fraction the other way round, a part too few, another reading. */
const fractionSlips: Mistakes = (exercise) => {
  const { numerator: n, denominator: d, input } = exercise as ReadExercise;
  if (input.kind === 'parts') return [String(n === 1 ? 2 : n - 1)];
  if (input.kind === 'choice') return [...input.options];
  return [`${d}/${n}`, `${n}/${d - n}`];
};

// A typical mistake, one notion per domain: Plume names it before the method (#168).
const NOTIONS: [domain: string, notion: string, level: number, mistakes?: Mistakes][] = [
  ['calcul mental', 'mental-math.subtract', 4],
  ['tables', 'times-tables.products', 3],
  ['nombres', 'numbers.decompose', 3],
  ['convertir', 'units.convert', 3],
  ['unités de temps', 'time.units', 3],
  ['graduations', 'measures.read-gauge', 3],
  ['heure', 'time.read-clock', 3, swappedHands],
  ['problèmes', 'word-problems.add-subtract', 1, offByOne],
  ['comparer des longueurs', 'units.compare-lengths', 1, () => ['<', '>', '=']],
  ['fractions', 'fractions.read', 2, fractionSlips],
  ['division', 'division.divide', 2],
];

for (const [domain, id, level, mistakes] of NOTIONS) {
  test(`${domain} : une erreur typique, Plume la nomme (${id})`, async ({ page }) => {
    const skill = skillsById(DOMAINS).get(id)!;
    await page.goto(`./?practice=${id}&level=${level}&seed=3&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    const exercise = await current(page);
    const method = skill.hint(exercise, 1);
    const lure = (mistakes?.(exercise) ?? skill.lures!(exercise).map(String)).find(
      (answer) => answer !== exercise.answer && skill.hint(exercise, 1, { answer }) !== method,
    );
    expect(lure, exercise.statement).toBeDefined();
    await driver(exercise.input).answer(page, exercise.input, lure!);
    const hint = page.locator('#question .hint');
    await expect(hint).toContainText('Presque !');
    const [mistake] = skill.hint(exercise, 1, { answer: lure! }).split('\n');
    await expect(hint).toContainText(mistake);
    await expectSlateLayout(page);
    await test.info().attach('indice', { body: await page.screenshot(), contentType: 'image/png' });
  });
}
