import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { apart, boxes } from './helpers';

type Point = [number, number];

const view = (page: Page) => page.evaluate(() => window.__numebois!.view());

/** Real touches on the screen (one or two fingers), moved in steps along `at(t)`. */
async function touch(cdp: CDPSession, at: (t: number) => Point[], steps = 6) {
  const points = (t: number) => at(t).map(([x, y], id) => ({ x, y, id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
  for (let s = 1; s <= steps; s++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(s / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const drag =
  (from: Point, to: Point) =>
  (t: number): Point[] => [[from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]];

/** Two fingers around a centre: apart by `gap(t)`, turned by `angle(t)` radians. */
const pair =
  (centre: Point, gap: (t: number) => number, angle: (t: number) => number, slide = 0) =>
  (t: number): Point[] => {
    const [dx, dy] = [(Math.cos(angle(t)) * gap(t)) / 2, (Math.sin(angle(t)) * gap(t)) / 2];
    const y = centre[1] + slide * t;
    return [
      [centre[0] - dx, y - dy],
      [centre[0] + dx, y + dy],
    ];
  };

test('se promener dans la forêt : gestes dans leurs limites, retour au cadrage, rien pendant une question', async ({
  page,
}) => {
  // About a minute with three workers on the workstation: room for CI.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  const cdp = await page.context().newCDPSession(page);
  const home = { yaw: 0, pitch: 0, zoom: 1, x: 0, z: 0 };

  // The game opens on the landscape, lit, the child's at once: a walk with the fingers.
  await expect(page.locator('#question')).toHaveCount(0);
  await expect(page.locator('#dim')).not.toHaveClass(/on/);
  const viewport = page.viewportSize()!;
  const walk = page.locator('#walk');
  const back = walk.getByRole('button', { name: 'Revenir' });
  const hint = walk.locator('.hint');
  await expect(walk).toBeVisible();
  await expect(hint).toBeVisible();
  await expect(back).toBeHidden();
  expect(await view(page)).toMatchObject({ goal: home, active: true });
  // How to move at the top; the trail waits at the bottom, its sign at its start.
  const trail = page.getByRole('button', { name: 'Chemin du progrès' }).and(page.locator('#trail'));
  await expect(trail.locator('.sign')).toHaveText('Chemindu progrès');
  await expect
    .poll(async () => {
      const [path, sign] = await boxes(page, '#trail, #trail .sign');
      return [Math.round(viewport.height - path.y - path.height), sign.width > 150];
    })
    .toEqual([12, true]);
  await test.info().attach('accueil', { body: await page.screenshot(), contentType: 'image/png' });
  const [hintBox] = await boxes(page, '#walk .hint');
  const [pathBox, signBox] = await boxes(page, '#trail, #trail .sign');
  const bar = await boxes(page, '#reserve, #seasons, #sound-toggle, #album-button');
  for (const box of [...bar, pathBox, signBox]) expect(apart(box, hintBox)).toBe(true);
  // What can be touched is big enough: the reserve, the trail and its sign.
  for (const box of [...bar, pathBox, signBox]) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }

  // Pinch: zoom in, up to its limit and no further.
  await touch(
    cdp,
    pair(
      [640, 330],
      (t) => 120 + 800 * t,
      () => 0,
    ),
  );
  expect((await view(page)).goal.zoom).toBe(2.5);
  await expect(back).toBeVisible();
  // Away from the framing, the landscape alone: the trail steps aside.
  await expect(page.locator('#trail')).toHaveClass(/aside/);
  await expect(trail).toHaveCount(0);
  // Once the child has moved, the hint has done its work: the whole painting takes its place.
  await expect(hint).toHaveCount(0);
  const [backBox] = await boxes(page, '#walk .whole');
  expect(Math.min(backBox.width, backBox.height)).toBeGreaterThanOrEqual(56);
  for (const box of [...bar, pathBox, signBox]) expect(apart(box, backBox)).toBe(true);

  // One finger moves the view; far away, it stops at the edge of the painting.
  await touch(cdp, drag([300, 330], [1000, 330]));
  const moved = (await view(page)).goal;
  expect(moved.x).toBeLessThan(0);
  await touch(cdp, drag([300, 330], [1000, 330]));
  await touch(cdp, drag([300, 330], [1000, 330]));
  const edge = (await view(page)).goal;
  await touch(cdp, drag([300, 330], [1000, 330]));
  expect((await view(page)).goal.x).toBeCloseTo(edge.x, 5);
  expect(edge.x).toBeLessThan(moved.x);

  // Twist and slide with two fingers: turn and tilt, a few tens of degrees at most.
  await touch(
    cdp,
    pair(
      [640, 330],
      () => 300,
      (t) => 1.6 * t,
    ),
  );
  expect((await view(page)).goal.yaw).toBe(35);
  await touch(
    cdp,
    pair(
      [640, 250],
      () => 300,
      () => 0,
      300,
    ),
  );
  expect((await view(page)).goal.pitch).toBe(8);
  await page.waitForTimeout(500);
  await test.info().attach('au plus loin', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // One touch back to the framing, gliding.
  await back.click();
  expect((await view(page)).goal).toEqual(home);
  await expect(back).toBeHidden();
  await expect(trail).toBeVisible();
  await expect.poll(async () => (await view(page)).now).toEqual(home);

  // The mouse too: the wheel zooms.
  await page.mouse.move(640, 330);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await view(page)).goal.zoom).toBeGreaterThan(1.5);
  await expect(trail).toHaveCount(0);
  await back.click();

  // A touch on the trail starts it.
  await trail.click();
  await expect(walk).toHaveCount(0);
  await expect(page.locator('#question')).toBeVisible();
  expect(await view(page)).toMatchObject({ goal: home, active: false });
  await expect.poll(async () => (await view(page)).now).toEqual(home);

  // During a question, the forest stays where it is, whatever the fingers do.
  await touch(cdp, drag([120, 300], [120, 600]));
  await touch(
    cdp,
    pair(
      [120, 450],
      (t) => 80 + 200 * t,
      (t) => t,
    ),
  );
  expect(await view(page)).toMatchObject({ goal: home, now: home, active: false });
  expect(errors).toEqual([]);
});
