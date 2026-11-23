import { curriculum } from './core/registry';
import { DOMAINS } from './domains';
import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { Reward, SoundState } from './scene/audio/soundscape';
import { newPainting, parseDescription, type SceneDescription } from './scene/description';
import { mountDebugPanel } from './scene/debug';
import { parseSave, practiceSave } from './save/save';
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
      sound(): {
        state: SoundState;
        context: AudioContextState | 'none';
        loaded: number;
        played: readonly Reward[];
      };
      game(): GameProbe | null;
      view(): ReturnType<SceneApp['view']>;
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
// The landscape alone can always be explored.
if (sceneOnly) app.explore(() => undefined);
const ready = sceneOnly
  ? app.start()
  : readSave()
      .catch((error: unknown) => {
        console.warn('sauvegarde illisible', error);
        return undefined;
      })
      .then((json) => {
        // Every notion, in the order of the curriculum: the trail chooses among them.
        const all = curriculum(DOMAINS);
        // `?practice=<notion>&level=<n>`: that notion alone from that level, on a new painting,
        // without reading or writing the save (tests, trying a new notion).
        const practice = all.find((skill) => skill.id === params.get('practice'));
        const skills = practice ? [practice] : all;
        const saved = json === undefined || practice ? null : parseSave(json, skills);
        // The painting in progress, or a new one (`?seed=`, `?season=` and `?biome=` choose it).
        const asked = parseDescription(params);
        app.description = saved?.ok
          ? saved.data.painting
          : newPainting(params.has('seed') ? asked.seed : randomSeed(), asked.season, asked.biome);
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
            adopt: (animal) => app.adopt(animal),
            changeSeason: (season) => app.changeSeason(season),
            portrait: (animal) => app.portrait(animal),
            reward: (kind) => app.sound.reward(kind),
            explore: (onAway) => app.explore(onAway),
            recenter: () => app.recenter(),
            quality: () => ({ chosen: app.qualityChoice, current: app.quality }),
            setQuality: (quality) => app.setQuality(quality),
          },
          practice ? practiceSave(practice, Number(params.get('level')), app.description) : saved,
          practice
            ? () => undefined
            : (data) => void writeSave(data).catch((error: unknown) => console.warn(error)),
          // A notion alone starts on its first question; the game on the welcome card.
          !practice,
        );
        // During a question, the soundscape stays low and plays no calls.
        app.sound.quiet = () =>
          ![
            'welcome',
            'walking',
            'seed',
            'shop',
            'choosing',
            'planting',
            'adopting',
            'turning',
          ].includes(game?.phase ?? '');
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
    played: [...app.sound.played],
  }),
  game: () => game && { ...game },
  view: () => app.view(),
};
mountSoundButton(app.sound);

window.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') app.grow();
});

if (params.has('debug')) mountDebugPanel(app);
