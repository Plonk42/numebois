import { expect, test } from '@playwright/test';
import {
  MAX_BUBBLE_CHARS,
  MAX_BUBBLE_SENTENCES,
  MAX_STATEMENT_WORDS,
} from '../../src/core/content';
import { curriculum } from '../../src/core/registry';
import { DOMAINS } from '../../src/domains';
import { current, driver, expectSlateLayout, game, wrong } from './helpers';

test('l’ardoise tient l’énoncé le plus long permis avec la bulle la plus haute', async ({
  page,
}) => {
  await page.goto('./?practice=numbers.write-digits&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  for (const answer of [wrong(exercise.answer), wrong(wrong(exercise.answer))]) {
    await driver(exercise.input).answer(page, exercise.input, answer);
  }
  const card = page.locator('#question');
  await expect(card.locator('.hint .next')).toBeVisible();
  // A word problem as long as the content tests allow, and a bubble as long, in as many lines.
  const words =
    'Plume ramasse 245 glands près du ruisseau puis encore 178 sous les grands chênes'.split(' ');
  const statement = Array.from({ length: MAX_STATEMENT_WORDS }, (_, i) => words[i % words.length]);
  const line = 'Ajoute les centaines, puis les dizaines et enfin les unités.'.slice(
    0,
    Math.floor(MAX_BUBBLE_CHARS / MAX_BUBBLE_SENTENCES) - 1,
  );
  const bubble = Array.from({ length: MAX_BUBBLE_SENTENCES }, () => line).join('\n');
  expect(bubble.length).toBeGreaterThan(MAX_BUBBLE_CHARS - MAX_BUBBLE_SENTENCES);
  await card.evaluate(
    (element, [text, hint]) => {
      const node = element.querySelector('.statement')!;
      node.className = 'statement text';
      node.textContent = text;
      element.querySelector('.hint span')!.textContent = hint;
    },
    [`${statement.join(' ')} ?`, bubble],
  );
  await expectSlateLayout(page);
  await test
    .info()
    .attach('pire énoncé', { body: await page.screenshot(), contentType: 'image/png' });
});

// Every notion of the registry, played on the slate through its widget (`?practice`): a new
// notion is checked here without writing anything, as in tests/unit/content.test.ts.
for (const skill of curriculum(DOMAINS)) {
  test(`${skill.id} : sur l’ardoise, l’indice, la réponse montrée, puis au dernier niveau`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const top = skill.levels - 1;
    await page.goto(`./?practice=${skill.id}&level=${top}&seed=3&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    const card = page.locator('#question');
    const hint = card.locator('.hint');

    // The warm-up, one level below: two mistakes, then the answer is shown with its method.
    let exercise = await current(page);
    expect(exercise.skill).toBe(skill.id);
    await expectSlateLayout(page);
    let wrongs = driver(exercise.input).wrongs(exercise.input, exercise.answer);
    await driver(exercise.input).answer(page, exercise.input, wrongs[0]);
    await expect(hint).toContainText('Presque !');
    // The answer tried keeps a soft colour (the choice tried, dimmed) until it changes.
    await expect(card.locator('.tried').first()).toBeVisible();
    await expectSlateLayout(page);
    if (wrongs.length > 1) {
      await driver(exercise.input).answer(page, exercise.input, wrongs[1]);
      await expect(hint).toContainText('On regarde ensemble.');
      await expectSlateLayout(page);
      await hint.getByRole('button', { name: 'Suivant' }).click();
    } else {
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    }

    // Right answers until one at the last level, after a hint there too.
    let reached = false;
    for (let stone = 1; stone < 10 && !reached; stone++) {
      await expect.poll(async () => (await game(page)).stone).toBe(stone);
      exercise = await current(page);
      expect(exercise.level).toBeLessThanOrEqual(top);
      if (exercise.level === top) {
        wrongs = driver(exercise.input).wrongs(exercise.input, exercise.answer);
        await driver(exercise.input).answer(page, exercise.input, wrongs[0]);
        await expect(hint).toContainText('Presque !');
        await expectSlateLayout(page);
        await test.info().attach(`${skill.id}, niveau ${top}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
      await expect(card.locator('.praise')).toBeVisible();
      reached = exercise.level === top;
    }
    expect(reached).toBe(true);
    expect(errors).toEqual([]);
  });
}
