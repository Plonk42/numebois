import { curriculum } from './core/registry';
import { DOMAINS } from './domains';
import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { SoundState } from './scene/audio/soundscape';
import { newPainting, parseDescription, type SceneDescription } from './scene/description';
import { mountDebugPanel } from './scene/debug';
import { parseQuality } from './scene/render/quality';
import { parseSave } from './save/save';
import { persistStorage, readSave, writeSave } from './save/store';
import { mountGame, type GameProbe } from './ui/game';

declare global {
  interface Window {
    /** Hooks for the end-to-end tests and the console. */
    __numebois?: {
      ready: Promise<void>;
      counters(): SceneCounters;
      describe(): SceneDescription;
      trees(): { family: string; detail: string; triangles: number }[];
      grow(): void;
      sound(): { state: SoundState; context: AudioContextState | 'none'; loaded: number };
      game(): GameProbe | null;
    };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const params = new URLSearchParams(window.location.search);
const app = new SceneApp(canvas, params, import.meta.env.BASE_URL);
const randomSeed = () => Math.floor(Math.random() * 1_000_000);

// `?scene` (captures) and `?debug` show the landscape alone, as the address describes it.
let game: GameProbe | null = null;
const sceneOnly = params.has('scene') || params.has('debug');
const ready = sceneOnly
  ? app.start()
  : readSave()
      .catch((error: unknown) => {
        console.warn('sauvegarde illisible', error);
        return undefined;
      })
      .then((json) => {
        // Every notion, in the order of the curriculum: the trail chooses among them.
        const skills = curriculum(DOMAINS);
        const saved = json === undefined ? null : parseSave(json, skills);
        // The painting in progress, or a new one (`?seed=` and `?season=` choose it).
        const asked = parseDescription(params);
        app.description = saved?.ok
          ? saved.data.painting
          : newPainting(params.has('seed') ? asked.seed : randomSeed(), asked.season);
        const started = app.start();
        persistStorage();
        game = mountGame(
          document.querySelector<HTMLElement>('#ui')!,
          skills,
          Date.now() >>> 0,
          {
            description: () => app.description,
            candidates: () => app.candidates(),
            slotKind: (slot) => app.slotKind(slot),
            slotOnScreen: (slot) => app.slotOnScreen(slot),
            plant: (slot, day) => app.plant(slot, day),
          },
          saved,
          (data) => void writeSave(data).catch((error: unknown) => console.warn(error)),
        );
        // During a question, the soundscape stays low and plays no calls.
        app.sound.quiet = () =>
          !['seed', 'summary', 'choosing', 'planting'].includes(game?.phase ?? '');
        return started;
      });

window.__numebois = {
  ready,
  counters: () => app.counters(),
  describe: () => app.description,
  trees: () => app.painting?.treeInfos() ?? [],
  grow: () => app.grow(),
  sound: () => ({
    state: app.sound.state,
    context: app.sound.contextState,
    loaded: app.sound.loaded,
  }),
  game: () => game && { ...game },
};
mountSoundButton(app.sound);

window.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') app.grow();
});

if (params.has('debug')) {
  mountDebugPanel(app, parseQuality(params.get('quality')) === 'auto');
}
