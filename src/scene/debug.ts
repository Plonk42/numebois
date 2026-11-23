import type { SceneApp, SceneCounters } from './app';
import {
  LANDMARKS,
  STAGES,
  demoAnimals,
  demoElements,
  fillOf,
  writeDescription,
  type Landmark,
  type Stage,
} from './description';
import { QUALITIES, type Quality } from './render/quality';
import { STAGE_NAMES } from './render/richness';
import { SEASONS, type Season } from './trees/builder';

const SEASON_LABELS: Record<Season, string> = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
};
const QUALITY_LABELS: Record<Quality | 'auto', string> = {
  auto: 'Automatique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};
const LANDMARK_LABELS: Record<Landmark, string> = {
  lake: 'Le lac',
  mountain: 'La montagne',
  season: 'La saison suivante',
};

const STYLE = `
#debug-panel {
  position: fixed; top: 8px; left: 8px; z-index: 10; width: 250px;
  font: 13px/1.35 system-ui, sans-serif; color: #17324a;
  background: rgba(255, 255, 255, 0.86); border-radius: 12px; padding: 10px 12px;
  box-shadow: 0 2px 10px rgba(0, 40, 80, 0.2);
}
#debug-panel label { display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 6px; margin: 4px 0; }
#debug-panel select, #debug-panel input { font: inherit; min-height: 28px; width: 100%; box-sizing: border-box; }
#debug-panel button { font: inherit; width: 100%; min-height: 36px; margin: 6px 0; border: 0; border-radius: 8px; background: #3f9a3a; color: #fff; }
#debug-panel dl { display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; margin: 6px 0 0; font-variant-numeric: tabular-nums; }
#debug-panel dt { opacity: 0.75; }
#debug-panel dd { margin: 0; text-align: right; }
#debug-panel .over { color: #c0262d; font-weight: 600; }
#debug-panel p { margin: 6px 0 0; font-size: 12px; }
#debug-panel fieldset { border: 0; margin: 4px 0; padding: 0; }
#debug-panel legend { padding: 0; opacity: 0.75; }
#debug-panel fieldset label { display: flex; gap: 6px; margin: 2px 0; }
#debug-panel fieldset input { width: auto; min-height: 0; }
`;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function select<T extends string>(
  id: string,
  options: readonly T[],
  labels: Record<T, string>,
  value: T,
  onChange: (value: T) => void,
): HTMLSelectElement {
  const el = element('select', { id });
  for (const option of options)
    el.append(element('option', { value: option, textContent: labels[option] }));
  el.value = value;
  el.addEventListener('change', () => onChange(el.value as T));
  return el;
}

/** Budget of the tablet: counters over it are highlighted. */
export const BUDGET = { drawCalls: 100, triangles: 150_000, memoryMb: 64 };

/** Debug panel (`?debug`): stage, season, seed and quality controls, live counters. */
export function mountDebugPanel(app: SceneApp, autoQuality: boolean): void {
  document.head.append(element('style', { textContent: STYLE }));
  const panel = element('div', { id: 'debug-panel' });
  const apply = () => {
    const url = new URL(window.location.href);
    writeDescription(url.searchParams, app.description);
    window.history.replaceState(null, '', url);
    app.rebuild();
  };

  const stageValue = element('span', {
    textContent: `${app.description.stage} · ${STAGE_NAMES[app.description.stage]}`,
  });
  const stage = element('input', {
    id: 'debug-stage',
    type: 'range',
    min: '0',
    max: String(STAGES.length - 1),
    step: '1',
    value: String(app.description.stage),
  });
  stage.addEventListener('input', () => {
    const next = Number(stage.value) as Stage;
    app.description = { ...app.description, stage: next, animals: demoAnimals(next) };
    stageValue.textContent = `${stage.value} · ${STAGE_NAMES[app.description.stage]}`;
    apply();
  });
  const seed = element('input', {
    id: 'debug-seed',
    type: 'number',
    min: '0',
    value: String(app.description.seed),
  });
  seed.addEventListener('change', () => {
    const next = Math.max(0, Math.floor(Number(seed.value) || 0));
    app.description = {
      ...app.description,
      seed: next,
      elements: demoElements(next, fillOf(app.description)),
    };
    apply();
  });
  const fillValue = element('span', {
    textContent: `${Math.round(fillOf(app.description) * 100)} %`,
  });
  const fill = element('input', {
    id: 'debug-fill',
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    value: String(Math.round(fillOf(app.description) * 100)),
  });
  fill.addEventListener('input', () => {
    app.description = {
      ...app.description,
      elements: demoElements(app.description.seed, Number(fill.value) / 100),
    };
    fillValue.textContent = `${fill.value} %`;
    apply();
  });
  const landmarks = element('fieldset', { id: 'debug-landmarks' }, [
    element('legend', { textContent: 'Grands moments' }),
  ]);
  for (const landmark of LANDMARKS) {
    const box = element('input', {
      id: `debug-landmark-${landmark}`,
      type: 'checkbox',
      checked: app.description.landmarks.includes(landmark),
    });
    box.addEventListener('change', () => {
      const revealed = app.description.landmarks;
      app.description = {
        ...app.description,
        landmarks: LANDMARKS.filter((l) => (l === landmark ? box.checked : revealed.includes(l))),
      };
      apply();
    });
    landmarks.append(element('label', {}, [box, LANDMARK_LABELS[landmark]]));
  }

  const stats = element('dl');
  const note = element('p');
  panel.append(
    element('label', {}, ['Palier', stage]),
    stageValue,
    element('label', {}, [
      'Saison',
      select('debug-season', SEASONS, SEASON_LABELS, app.description.season, (season) => {
        app.description = { ...app.description, season };
        apply();
      }),
    ]),
    element('label', {}, ['Graine', seed]),
    element('label', {}, ['Emplacements', fill]),
    fillValue,
    landmarks,
    element('label', {}, [
      'Qualité',
      select(
        'debug-quality',
        ['auto', ...QUALITIES] as const,
        QUALITY_LABELS,
        autoQuality ? 'auto' : app.quality,
        (quality) => app.setQuality(quality),
      ),
    ]),
  );
  const grow = element('button', { id: 'debug-grow', textContent: 'Faire pousser un arbre (G)' });
  grow.addEventListener('click', () => app.grow());
  panel.append(grow, stats, note);
  document.body.append(panel);

  const row = (label: string, value: string, over = false) => {
    stats.append(
      element('dt', { textContent: label }),
      element('dd', { textContent: value, className: over ? 'over' : '' }),
    );
  };
  const format = new Intl.NumberFormat('fr-FR');
  app.onCounters = (c: SceneCounters) => {
    stats.replaceChildren();
    row('Images par seconde', c.fps.toFixed(0));
    row('Appels de dessin', String(c.drawCalls), c.drawCalls > BUDGET.drawCalls);
    row('Triangles (scène)', format.format(c.triangles), c.triangles > BUDGET.triangles);
    row('Triangles (avec ombres)', format.format(c.renderedTriangles));
    row('Mémoire graphique', `${c.sceneMemoryMb.toFixed(1)} Mo`, c.sceneMemoryMb > BUDGET.memoryMb);
    row('Tampon d’affichage', `${c.bufferMemoryMb.toFixed(1)} Mo`);
    row('Arbres', `${c.trees} · ${format.format(c.treeTriangles)} tri.`);
    row('Plus gros arbre', `${format.format(c.largestTree)} tri.`);
    row('Génération des arbres', `${c.treeGenerationMs.toFixed(1)} ms`);
    row('Instances', format.format(c.instances));
    row('Animaux', `${c.animals} · ${format.format(c.animalTriangles)} tri.`);
    row(
      'Qualité',
      `${QUALITY_LABELS[c.quality]}${c.autoQuality ? ' (auto)' : ''} · ×${c.pixelRatio.toFixed(2)}`,
    );
    note.textContent = c.placeholders
      ? 'Formes de remplacement : lancer « npm run assets » avec les packs KayKit.'
      : '';
  };
}
