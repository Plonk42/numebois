import { DOMAINS } from './domains';
import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { SoundState } from './scene/audio/soundscape';
import type { SceneDescription } from './scene/description';
import { mountDebugPanel } from './scene/debug';
import { parseQuality } from './scene/render/quality';
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
const game =
  params.has('scene') || params.has('debug')
    ? null
    : mountGame(
        document.querySelector<HTMLElement>('#ui')!,
        // Every notion, in the order of the curriculum: the trail chooses among them.
        DOMAINS.flatMap((domain) => domain.skills),
        Date.now() >>> 0,
        () => app.grow(),
      );

window.__numebois = {
  ready: app.start(),
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
