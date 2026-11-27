import { expect, test } from '@playwright/test';
import { skillsById } from '../../src/core/registry';
import { DOMAINS } from '../../src/domains';
import { current, driver, expectSlateLayout } from './helpers';

// A typical mistake, one notion per domain: Plume names it before the method (#168).
const NOTIONS: [domain: string, notion: string, level: number][] = [
  ['calcul mental', 'mental-math.subtract', 4],
  ['tables', 'times-tables.products', 3],
  ['nombres', 'numbers.decompose', 3],
  ['convertir', 'units.convert', 3],
  ['unités de temps', 'time.units', 3],
  ['graduations', 'measures.read-gauge', 3],
];

for (const [domain, id, level] of NOTIONS) {
  test(`${domain} : une erreur typique, Plume la nomme (${id})`, async ({ page }) => {
    const skill = skillsById(DOMAINS).get(id)!;
    await page.goto(`./?practice=${id}&level=${level}&seed=3&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    const exercise = await current(page);
    const method = skill.hint(exercise, 1);
    const lure = skill.lures!(exercise)
      .map(String)
      .find(
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
