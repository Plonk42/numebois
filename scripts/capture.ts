/**
 * Visual review captures: fixed camera, frozen time. Writes one PNG per scene and a contact
 * sheet under `test-results/captures/`.
 *
 *   npm run capture -- --forms clearing,hex --stages 0,6,11 --seasons summer [--seed 7,8,9]
 *     [--size 1280x800] [--url http://127.0.0.1:5173/numebois/] [--name review] [--time 12]
 *
 * Needs a running server (`npm run dev` or `npm run preview`).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const forms = option('forms', 'clearing,hex').split(',');
const stages = option('stages', '0,6,11').split(',');
const seasons = option('seasons', 'summer').split(',');
const seeds = option('seed', '7').split(',');
const time = option('time', '12');
const quality = option('quality', 'high');
const extra = option('query', '');
const url = option('url', 'http://127.0.0.1:5173/numebois/');
const name = option('name', 'review');
const [width, height] = option('size', '1280x800').split('x').map(Number);
const columns = Number(option('columns', String(stages.length * seasons.length * seeds.length)));
const out = resolve('test-results', 'captures');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=default'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('console', (message) => {
  if (message.type() === 'error') console.error(`[console] ${message.text()}`);
});
page.on('pageerror', (error) => console.error(`[page] ${error.message}`));

const files: { file: string; label: string }[] = [];
for (const form of forms) {
  for (const season of seasons) {
    for (const stage of stages)
      for (const seed of seeds) {
        const query = `?form=${form}&stage=${stage}&season=${season}&seed=${seed}&quality=${quality}&time=${time}${extra ? `&${extra}` : ''}`;
        await page.goto(url + query);
        await page.evaluate(() => window.__numebois!.ready);
        // Two frames, so the shadow map and the instanced buffers are drawn.
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        );
        const counters = await page.evaluate(() => window.__numebois!.counters());
        if (process.argv.includes('--trees')) {
          const trees = await page.evaluate(() => window.__numebois!.trees());
          const groups = new Map<string, number[]>();
          for (const t of trees) {
            const k = `${t.family}/${t.detail}`;
            groups.set(k, [...(groups.get(k) ?? []), t.triangles]);
          }
          for (const [k, list] of groups) {
            console.log(
              `  ${k}: ${list.length} × ~${Math.round(list.reduce((a, b) => a + b, 0) / list.length)} (max ${Math.max(...list)})`,
            );
          }
        }
        const file = `${name}-${form}-${season}-${stage}-${seed}.png`;
        await page.screenshot({ path: join(out, file) });
        files.push({ file, label: `${form} · ${season} · palier ${stage} · graine ${seed}` });
        console.log(
          `${file}: ${counters.drawCalls} appels, ${counters.triangles} triangles ` +
            `(${counters.renderedTriangles} avec ombres), ${counters.sceneMemoryMb.toFixed(1)} Mo, ` +
            `arbres ${counters.trees} en ${counters.treeGenerationMs.toFixed(1)} ms ` +
            `[arbres ${counters.treeTriangles}, sol ${counters.groundTriangles}, eau ${counters.waterTriangles}, ` +
            `instances ${counters.instancedTriangles}, nuages ${counters.cloudTriangles}]` +
            (counters.placeholders ? ' [formes de remplacement]' : ''),
        );
      }
  }
}

// Contact sheet, rendered by the browser.
const cell = Math.round(1800 / columns);
const sheet = await browser.newPage({
  viewport: { width: cell * columns, height: 100 },
  deviceScaleFactor: 1,
});
const cells = files
  .map((f) => {
    const data = readFileSync(join(out, f.file)).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${f.label}</figcaption></figure>`;
  })
  .join('');
await sheet.setContent(`<style>
  body { margin: 0; display: grid; grid-template-columns: repeat(${columns}, 1fr); background: #222; }
  figure { margin: 0; position: relative; }
  img { width: 100%; display: block; }
  figcaption { position: absolute; left: 6px; top: 4px; font: 600 13px system-ui; color: #fff; text-shadow: 0 1px 3px #000; }
</style>${cells}`);
await sheet.waitForFunction(() => [...document.images].every((image) => image.complete));
await sheet.screenshot({
  path: join(out, `${name}-sheet.jpg`),
  fullPage: true,
  type: 'jpeg',
  quality: 82,
});
console.log(join(out, `${name}-sheet.jpg`));
await browser.close();
