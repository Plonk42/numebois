import { isAutomated } from '../core/facts';
import { masteryRate, type Stage as MasteryStage } from '../core/mastery';
import type { Skill } from '../core/types';
import { element } from '../scene/debug';
import { MAX_ELEMENTS, writeDescription, type SceneDescription } from '../scene/description';
import type { GameDebug, GameProbe } from './game';

const MASTERY_LABELS: Record<MasteryStage, string> = {
  discovery: 'découverte',
  learning: 'apprentissage',
  acquired: 'acquise',
  maintenance: 'révisions',
  anchored: 'ancrée',
};

const STYLE = `
#sandbox-panel {
  position: fixed; top: 80px; right: 8px; z-index: 20; width: 204px;
  max-height: calc(100vh - 96px); overflow-y: auto; box-sizing: border-box;
  font: 12px/1.35 system-ui, sans-serif; color: #17324a;
  background: rgba(255, 255, 255, 0.9); border-radius: 12px; padding: 8px 10px;
  box-shadow: 0 2px 10px rgba(0, 40, 80, 0.2);
}
#sandbox-panel summary { font-weight: 600; cursor: pointer; }
#sandbox-panel .row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 4px 0; }
#sandbox-panel button {
  font: inherit; min-height: 32px; border: 0; border-radius: 8px; background: #3f9a3a; color: #fff;
}
#sandbox-panel dl { display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; margin: 6px 0; }
#sandbox-panel dt { opacity: 0.75; }
#sandbox-panel dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
#sandbox-panel p { margin: 4px 0 0; }
`;

/** Section of the landscape panel (`?debug`): plays this painting in the sandbox. */
export function sandboxForm(
  skills: readonly Skill[],
  description: () => SceneDescription,
): HTMLElement {
  const notion = element('select', { id: 'debug-notion' }, [
    element('option', { value: '', textContent: 'Toutes (nouvelle partie)' }),
    ...skills.map((skill) => element('option', { value: skill.id, textContent: skill.name })),
  ]);
  const level = element('select', { id: 'debug-level' });
  const levels = () => {
    const skill = skills.find((s) => s.id === notion.value);
    level.replaceChildren(
      ...Array.from({ length: skill?.levels ?? 1 }, (_, i) =>
        element('option', { value: String(i), textContent: String(i) }),
      ),
    );
    level.disabled = !skill;
  };
  levels();
  notion.addEventListener('change', levels);
  const leaves = element('input', { id: 'debug-leaves', type: 'number', min: '0', value: '100' });
  const seeds = element('input', { id: 'debug-seeds', type: 'number', min: '0', value: '10' });
  const play = element('button', { id: 'debug-play', textContent: 'Jouer dans ce paysage' });
  play.addEventListener('click', () => {
    const { biome, seed, season, elements } = description();
    const url = new URL(window.location.href);
    const quality = url.searchParams.get('quality');
    url.search = '';
    const params = url.searchParams;
    params.set('sandbox', '');
    if (notion.value) params.set('practice', notion.value);
    if (notion.value) params.set('level', level.value);
    params.set('leaves', leaves.value);
    params.set('seeds', seeds.value);
    params.set('biome', biome);
    params.set('seed', String(seed));
    params.set('season', season);
    params.set('fill', String(Math.round((elements.length / MAX_ELEMENTS) * 100)));
    if (quality) params.set('quality', quality);
    window.location.href = url.href;
  });
  return element('details', { id: 'debug-sandbox' }, [
    element('summary', { textContent: 'Jouer (bac à sable)' }),
    element('label', {}, ['Notion', notion]),
    element('label', {}, ['Niveau', level]),
    element('label', {}, ['Feuilles', leaves]),
    element('label', {}, ['Graines', seeds]),
    element('p', {
      textContent:
        'Sans sauvegarde, avec les emplacements remplis du paysage ; le palier suit leur nombre.',
    }),
    play,
  ]);
}

/** Address of the landscape alone, as shown now. */
function landscapeUrl(description: SceneDescription): string {
  const url = new URL(window.location.href);
  const quality = url.searchParams.get('quality');
  url.search = '';
  url.searchParams.set('debug', '');
  writeDescription(url.searchParams, description);
  if (quality) url.searchParams.set('quality', quality);
  return url.href;
}

/** Panel of the sandbox (`?sandbox`): answers, reserve, progress of the notions. */
export function mountSandboxPanel(
  debug: GameDebug,
  probe: () => GameProbe | null,
  skills: readonly Skill[],
  description: () => SceneDescription,
): void {
  document.head.append(element('style', { textContent: STYLE }));
  const button = (id: string, text: string, action: () => void) => {
    const el = element('button', { id, type: 'button', textContent: text });
    el.addEventListener('click', action);
    return el;
  };
  let finishing = 0;
  const finish = () => {
    clearInterval(finishing);
    debug.start();
    finishing = window.setInterval(() => {
      const phase = probe()?.phase;
      if (phase === 'asking') debug.answer(true);
      else if (phase === 'walking') clearInterval(finishing);
    }, 200);
  };
  const landscape = button('debug-landscape', 'Paysage seul', () => {
    window.location.href = landscapeUrl(description());
  });
  const stats = element('dl');
  const notions = element('div');
  const panel = element('details', { id: 'sandbox-panel', open: true }, [
    element('summary', { textContent: 'Bac à sable (sans sauvegarde)' }),
    element('div', { className: 'row' }, [
      button('debug-right', 'Bonne réponse', () => debug.answer(true)),
      button('debug-wrong', 'Mauvaise réponse', () => debug.answer(false)),
    ]),
    element('div', { className: 'row' }, [
      button('debug-finish', 'Finir le sentier', finish),
      landscape,
    ]),
    element('div', { className: 'row' }, [
      button('debug-give-leaves', '+50 feuilles', () => debug.give(50, 0)),
      button('debug-give-seeds', '+10 graines', () => debug.give(0, 10)),
    ]),
    stats,
    notions,
  ]);
  document.body.append(panel);

  const names = new Map(skills.map((skill) => [skill.id, skill]));
  const refresh = () => {
    const game = probe();
    if (!game || !panel.open) return;
    const { progress, facts } = debug.progress();
    const rows: [string, string][] = [
      ['Phase', game.phase],
      ['Pierre', `${game.stone + 1} / ${game.stones}`],
      ['Réserve', `${game.leaves - game.basket} f. · ${game.seeds} g.`],
      ['Panier', `${game.basket} f.`],
      ['Palier', `${description().stage} (${description().elements.length} él.)`],
    ];
    if (game.exercise && ['asking', 'right', 'reveal'].includes(game.phase)) {
      const { skill, level } = debug.step();
      rows.push(
        ['Notion', names.get(skill)?.name ?? skill],
        ['Niveau', String(level)],
        ['Réponse', game.exercise.answer],
      );
    }
    rows.push(['Faits par cœur', String(facts.filter(isAutomated).length)]);
    stats.replaceChildren(
      ...rows.flatMap(([label, value]) => [
        element('dt', { textContent: label }),
        element('dd', { textContent: value }),
      ]),
    );
    notions.replaceChildren(
      ...progress.map((p) =>
        element('p', {}, [
          element('b', { textContent: names.get(p.skill)?.name ?? p.skill }),
          element('br'),
          `${MASTERY_LABELS[p.stage]} · niveau ${p.level} / ${(names.get(p.skill)?.levels ?? 1) - 1} · ${Math.round(masteryRate(p) * 100)} %`,
        ]),
      ),
    );
  };
  window.setInterval(refresh, 300);
}
