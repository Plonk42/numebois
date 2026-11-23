import { DOMAINS } from './domains';
import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { SoundState } from './scene/audio/soundscape';
import type { SceneDescription } from './scene/description';
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
      sound(): { state: SoundState; context: AudioContextState | 'none' };
      game(): GameProbe | null;
    };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const params = new URLSearchParams(window.location.search);
const app = new SceneApp(canvas, params, import.meta.env.BASE_URL);

// `?scene` (captures) and `?debug` show the landscape alone.
let game: GameProbe | null = null;
const gameReady =
  params.has('scene') || params.has('debug')
    ? Promise.resolve()
    : readSave()
        .catch((error: unknown) => {
          console.warn('sauvegarde illisible', error);
          return undefined;
        })
        .then((json) => {
          // Every notion, in the order of the curriculum: the trail chooses among them.
          const skills = DOMAINS.flatMap((domain) => domain.skills);
          persistStorage();
          game = mountGame(
            document.querySelector<HTMLElement>('#ui')!,
            skills,
            Date.now() >>> 0,
            () => app.grow(),
            json === undefined ? null : parseSave(json, skills),
            (data) => void writeSave(data).catch((error: unknown) => console.warn(error)),
          );
        });

window.__numebois = {
  ready: Promise.all([app.start(), gameReady]).then(() => undefined),
  counters: () => app.counters(),
  describe: () => app.description,
  trees: () => app.painting?.treeInfos() ?? [],
  grow: () => app.grow(),
  sound: () => ({ state: app.sound.state, context: app.sound.contextState }),
  game: () => game && { ...game },
};
mountSoundButton(app.sound);

window.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') app.grow();
});

if (params.has('debug')) {
  mountDebugPanel(app, parseQuality(params.get('quality')) === 'auto');
}
