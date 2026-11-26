import { describe, expect, it } from 'vitest';
import { dayLabel, isoDate } from '../../src/core/day';
import type { Quest } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import {
  exportFile,
  importFile,
  isFramed,
  parseAlbum,
  serializeAlbum,
  type AlbumEntry,
} from '../../src/save/album';
import { serializeSave } from '../../src/save/save';
import { nextBiomes, NEXT_CHOICES } from '../../src/scene/biomes';
import {
  BIOME_IDS,
  completed,
  isComplete,
  MAX_ELEMENTS,
  newPainting,
  readDescription,
} from '../../src/scene/description';

const SKILLS = DOMAINS.flatMap((domain) => domain.skills);
/** 1×1 transparent WebP. */
const PICTURE = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

function entry(seed: number, biome: 'clearing' | 'orchard' = 'clearing'): AlbumEntry {
  return {
    description: completed(newPainting(seed, 'summer', biome)),
    started: 20_400,
    finished: 20_410,
    acquired: ['numbers.write-digits'],
    automated: ['mental-math.complements:3+7'],
    picture: PICTURE,
  };
}

const quest = (biome: string): Quest => ({
  id: '2026-11-23',
  until: '2026-11-29',
  title: 'Les compléments',
  biome,
  skills: [],
});

describe('Album', () => {
  it('keeps complete paintings with their dates, what was learnt and a picture', () => {
    const entries = [entry(1), entry(2, 'orchard')];
    const parsed = parseAlbum(serializeAlbum(entries));
    expect(parsed).toEqual({ ok: true, entries });
    // Each one plays again exactly as it was described.
    expect(parsed.ok && parsed.entries.map((e) => readDescription(e.description))).toEqual(
      entries.map((e) => e.description),
    );
  });

  it('refuses an Album out of place, with a reason', () => {
    const broken = (change: object) =>
      parseAlbum(JSON.stringify({ version: 6, entries: [{ ...entry(1), ...change }] }));
    expect(parseAlbum('{')).toMatchObject({ ok: false });
    expect(parseAlbum(JSON.stringify({ version: 4, entries: [] }))).toMatchObject({ ok: false });
    const unfinished = newPainting(1, 'summer', 'clearing');
    expect(broken({ description: unfinished })).toMatchObject({ ok: false });
    expect(broken({ picture: 'https://example.com/x.webp' })).toMatchObject({ ok: false });
    expect(broken({ finished: 'hier' })).toMatchObject({ ok: false });
    expect(broken({ acquired: [1] })).toMatchObject({ ok: false });
  });

  it('knows whether the painting in progress is already framed', () => {
    const last = entry(3);
    expect(isFramed([], last.description)).toBe(false);
    expect(isFramed([entry(1), last], { ...last.description })).toBe(true);
    expect(isFramed([last, entry(1)], last.description)).toBe(false);
  });

  it('travels with the save in an exported file', () => {
    const save = serializeSave(
      {
        progress: [],
        facts: [],
        history: [],
        records: [],
        settings: [],
        automation: 1,
        longChallenges: false,
        plays: [],
        leaves: 2,
        seeds: 1,
        trailLength: 'short',
        painting: newPainting(4, 'summer', 'orchard'),
        journal: { started: 20_411, acquired: [], automated: [] },
        recommended: null,
        name: '',
        notebook: [],
      },
      new Date('2026-11-23T10:00:00Z'),
    );
    const entries = [entry(1)];
    const imported = importFile(exportFile(save, entries), SKILLS);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(JSON.parse(imported.save)).toEqual(JSON.parse(save));
    expect(parseAlbum(imported.album)).toEqual({ ok: true, entries });
    // A file without its Album, or with a broken one, is refused.
    expect(importFile(save, SKILLS)).toMatchObject({ ok: false, reason: 'Album abîmé.' });
  });
});

describe('next painting', () => {
  it('shows each décor complete, with every slot filled', () => {
    for (const biome of BIOME_IDS) {
      const full = completed(newPainting(5, 'winter', biome));
      expect(readDescription(full)).toEqual(full);
      expect(isComplete(full)).toBe(true);
      expect(full.elements).toHaveLength(MAX_ELEMENTS);
      expect(full).toMatchObject({ biome, seed: 5, season: 'winter', seasons: ['winter'] });
    }
    expect(isComplete(newPainting(5, 'winter', 'clearing'))).toBe(false);
  });

  it('offers the décors painted least, or the one of the quest of the week', () => {
    expect(nextBiomes([], '2026-11-23', [])).toEqual(['clearing', 'orchard', 'sky']);
    expect(nextBiomes([], '2026-11-23', ['clearing'])).toEqual(['orchard', 'sky', 'mountain']);
    expect(nextBiomes([], '2026-11-23', ['sky', 'clearing', 'orchard'])).toEqual([
      'mountain',
      'clearing',
      'orchard',
    ]);
    expect(nextBiomes([], '2026-11-23', [])).toHaveLength(Math.min(NEXT_CHOICES, 3));
    expect(nextBiomes([quest('orchard')], '2026-11-25', [])).toEqual(['orchard']);
    // Before or after the quest, or a décor that does not exist: the choice again.
    expect(nextBiomes([quest('orchard')], '2026-11-30', [])).toHaveLength(3);
    expect(nextBiomes([quest('orchard')], '2026-11-22', [])).toHaveLength(3);
    expect(nextBiomes([quest('moon')], '2026-11-25', [])).toHaveLength(3);
  });

  it('writes the days for the quests and for the child', () => {
    const day = Date.UTC(2026, 11, 1) / 86_400_000;
    expect(isoDate(day)).toBe('2026-12-01');
    expect(dayLabel(day)).toBe('1er décembre');
    expect(dayLabel(day + 2)).toBe('3 décembre');
  });
});
