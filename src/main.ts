import { curriculum } from './core/registry';
import { today } from './core/day';
import { DOMAINS } from './domains';
import { SceneApp, type SceneCounters } from './scene/app';
import { mountSoundButton } from './scene/audio/sound-button';
import type { Reward, SoundState } from './scene/audio/soundscape';
import {
  newPainting,
  parseDescription,
  stageFor,
  type SceneDescription,
} from './scene/description';
import { mountDebugPanel } from './scene/debug';
import { parseAlbum, type ParsedAlbum } from './save/album';
import { parseSave, practiceSave } from './save/save';
import { persistStorage, readAlbum, readSave, writeAlbum, writeSave } from './save/store';
import { mountSandboxPanel, sandboxForm } from './ui/debug';
import { mountGame, type GameDebug, type GameProbe } from './ui/game';

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
      camera(): ReturnType<SceneApp['camera']>;
      animals(): ReturnType<SceneApp['animalsOnScreen']>;
      slot(slot: number): ReturnType<SceneApp['slotOnScreen']>;
      touches(): SceneApp['touches'];
    };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const params = new URLSearchParams(window.location.search);
const app = new SceneApp(canvas, params, import.meta.env.BASE_URL);
const randomSeed = () => Math.floor(Math.random() * 1_000_000);

// `?scene` (captures) and `?debug` show the landscape alone, as the address describes it.
// `?sandbox` plays without the save, on the painting of the address, with the reserve given.
let game: GameProbe | null = null;
const sandbox = params.has('sandbox');
const sceneOnly = !sandbox && (params.has('scene') || params.has('debug'));
// The landscape alone can always be explored.
if (sceneOnly) app.explore(() => undefined);
const ready = sceneOnly
  ? app.start()
  : Promise.all([readSave(), readAlbum()])
      .catch((error: unknown) => {
        console.warn('sauvegarde illisible', error);
        return [undefined, undefined];
      })
      .then(([json, albumJson]) => {
        // Every notion, in the order of the curriculum: the trail chooses among them.
        const all = curriculum(DOMAINS);
        // `?practice=<notion>&level=<n>`: that notion alone from that level, on a new painting,
        // without reading or writing the save (tests, trying a new notion).
        const practice = all.find((skill) => skill.id === params.get('practice'));
        const skills = practice ? [practice] : all;
        const unsaved = practice !== undefined || sandbox;
        const saved = json === undefined || unsaved ? null : parseSave(json, skills);
        const album: ParsedAlbum =
          albumJson === undefined || unsaved ? { ok: true, entries: [] } : parseAlbum(albumJson);
        // The painting in progress, or a new one (`?seed=`, `?season=` and `?biome=` choose it).
        const asked = parseDescription(params);
        if (sandbox) {
          // The elements of `?fill=`, at their stage, nothing bought yet.
          app.description = { ...asked, stage: stageFor(asked.elements.length), animals: [] };
        } else {
          app.description = saved?.ok
            ? saved.data.painting
            : newPainting(
                params.has('seed') ? asked.seed : randomSeed(),
                asked.season,
                asked.biome,
              );
        }
        const started = app.start();
        persistStorage();
        const count = (name: string) => Math.max(0, Math.floor(Number(params.get(name)) || 0));
        const debug: GameDebug = {
          start: () => undefined,
          answer: () => undefined,
          give: () => undefined,
          progress: () => ({ progress: [], facts: [], history: [], records: [] }),
          step: () => ({ skill: '', level: 0 }),
        };
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
            trailArt: (stones) => app.trailArt(stones),
            ready: started,
            finale: () => app.finale(),
            picture: () => app.picture(),
            show: (description) => app.show(description),
            start: (description) => app.setDescription(description),
            cover: (on) => app.cover(on),
            reward: (kind) => app.sound.reward(kind),
            explore: (onAway) => app.explore(onAway),
            recenter: () => app.recenter(),
            quality: () => ({ chosen: app.qualityChoice, current: app.quality }),
            setQuality: (quality) => app.setQuality(quality),
          },
          unsaved
            ? practiceSave(
                practice ?? null,
                Number(params.get('level')),
                app.description,
                today(),
                { leaves: count('leaves'), seeds: count('seeds') },
              )
            : saved,
          album,
          unsaved
            ? () => undefined
            : (data) => void writeSave(data).catch((error: unknown) => console.warn(error)),
          unsaved
            ? () => undefined
            : (data) => void writeAlbum(data).catch((error: unknown) => console.warn(error)),
          // A notion alone starts on its first question; the game on the landscape.
          !practice,
          debug,
        );
        if (sandbox)
          mountSandboxPanel(
            debug,
            () => game,
            skills,
            () => app.description,
          );
        // During a question, the soundscape stays low and plays no calls.
        app.sound.quiet = () =>
          ![
            'walking',
            'seed',
            'drill-menu',
            'break',
            'challenge-menu',
            'challenge-end',
            'shop',
            'choosing',
            'planting',
            'adopting',
            'turning',
            'finale',
            'framing',
            'next',
            'album',
            'visiting',
            'carnet',
          ].includes(game?.phase ?? '');
        return started;
      });

window.__numebois = {
  ready,
  counters: () => app.counters(),
  describe: () => app.shown,
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
  camera: () => app.camera(),
  animals: () => app.animalsOnScreen(),
  slot: (slot) => app.slotOnScreen(slot),
  touches: () => [...app.touches],
};
mountSoundButton(app.sound);

window.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') app.grow();
});

if (sceneOnly && params.has('debug')) {
  mountDebugPanel(app).append(sandboxForm(curriculum(DOMAINS), () => app.description));
}
