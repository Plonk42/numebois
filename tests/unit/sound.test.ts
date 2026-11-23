import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_CATALOG, type SoundName } from '../../src/scene/audio/sound-catalog';
import { SOUND_BYTES, SOUND_FILES } from '../../src/scene/audio/sounds.gen';
import { STAGES } from '../../src/scene/description';
import { ambienceFor, type SoundLevels } from '../../src/scene/render/richness';

const names = Object.keys(SOUND_CATALOG) as SoundName[];

describe('sound files', () => {
  it('match the catalog and the committed files (run `npm run sounds` after a change)', () => {
    expect(Object.keys(SOUND_FILES).sort()).toEqual([...names].sort());
    let total = 0;
    for (const name of names) {
      const file = `public/${SOUND_FILES[name].file}`;
      expect(readFileSync(file).toString('latin1', 0, 4), name).toBe('OggS');
      total += statSync(file).size;
      const source = SOUND_CATALOG[name];
      expect(SOUND_FILES[name].cuts.length, name).toBe(
        source.kind === 'loop' ? 0 : source.cuts.length,
      );
    }
    expect(total).toBe(SOUND_BYTES);
  });

  it('fit in about 1 MB for the painting', () => {
    expect(SOUND_BYTES).toBeLessThan(1024 * 1024);
  });
});

describe('sound layers', () => {
  const active = (levels: SoundLevels) =>
    new Set(
      Object.entries(levels)
        .filter(([, v]) => v > 0)
        .map(([k]) => k),
    );

  it('add layers as the stages go, never remove one', () => {
    let before = new Set<string>();
    const news: number[] = [];
    for (const stage of STAGES) {
      const now = active(ambienceFor(stage, 'summer').sound);
      for (const layer of before) expect(now.has(layer), `${layer} at stage ${stage}`).toBe(true);
      if (now.size > before.size) news.push(stage);
      before = now;
    }
    expect(news).toEqual([0, 2, 3, 6, 9, 11]);
  });

  it('silences the insects and the cuckoo in winter', () => {
    const winter = ambienceFor(STAGES.at(-1)!, 'winter').sound;
    expect([winter.meadow, winter.crickets, winter.cuckoo]).toEqual([0, 0, 0]);
    expect(winter.wind).toBeGreaterThan(0);
  });
});
