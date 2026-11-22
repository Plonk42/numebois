import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { SoundState } from './scene/audio/soundscape';
import type { SceneDescription } from './scene/description';
import { mountDebugPanel } from './scene/debug';
import { parseQuality } from './scene/render/quality';

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
    };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const params = new URLSearchParams(window.location.search);
const app = new SceneApp(canvas, params, import.meta.env.BASE_URL);

window.__numebois = {
  ready: app.start(),
  counters: () => app.counters(),
  describe: () => app.description,
  trees: () => app.painting?.treeInfos() ?? [],
  grow: () => app.grow(),
  sound: () => ({ state: app.sound.state, context: app.sound.contextState }),
};
mountSoundButton(app.sound);

window.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') app.grow();
});

if (params.has('debug')) {
  mountDebugPanel(app, parseQuality(params.get('quality')) === 'auto');
}
