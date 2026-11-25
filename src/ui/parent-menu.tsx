import { useState } from 'preact/hooks';
import type { Session } from '../core/session';
import type { SkillSetting } from '../core/settings';
import type { TrailLength } from '../core/trail';
import type { Skill, SkillId } from '../core/types';
import { QUALITIES, QUALITY_LABELS, type Quality } from '../scene/render/quality';
import { importFile } from '../save/album';
import { AUTOMATION_FACTORS, type Recommended } from '../save/parent';
import { writeAlbum, writeSave } from '../save/store';
import { Notions, Progress } from './dashboard';

type Tab = 'progress' | 'notions' | 'settings';
const TABS: Record<Tab, string> = { progress: 'Suivi', notions: 'Notions', settings: 'Réglages' };

const AUTOMATION_LABELS: Record<(typeof AUTOMATION_FACTORS)[number], string> = {
  0.75: 'Exigeant',
  1: 'Normal',
  1.5: 'Souple',
};

interface Props {
  skills: readonly Skill[];
  session: Session;
  day: number;
  length: TrailLength;
  recommended: Recommended | null;
  /** Why the save could not be read at start, if it could not. */
  problem: string | null;
  exportSave(): string;
  quality(): { chosen: Quality | 'auto'; current: Quality };
  onQuality(quality: Quality | 'auto'): void;
  onLength(length: TrailLength): void;
  onSettings(settings: Map<SkillId, SkillSetting>): void;
  onAutomation(factor: number): void;
  onRecommended(recommended: Recommended | null): void;
  onClose(): void;
}

/**
 * Hidden parent dashboard (long press on the reserve, #47): the child's progress, the settings
 * of the notions, then trail length, automation, quality, export and import (Album included).
 */
export function ParentMenu({
  skills,
  session,
  day,
  length,
  recommended,
  problem,
  exportSave,
  quality,
  onQuality,
  onLength,
  onSettings,
  onAutomation,
  onRecommended,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(problem ? 'settings' : 'progress');
  const [message, setMessage] = useState(problem);
  const [{ chosen, current }, setQuality] = useState(quality);
  const [automation, setAutomation] = useState(session.automation);

  const download = () => {
    const day = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([exportSave()], { type: 'application/json' }));
    link.download = `numebois-${day}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const upload = () => {
    // Created on demand: no text field may stay on the page.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const text = await input.files?.[0]?.text();
      if (text === undefined) return;
      const parsed = importFile(text, skills);
      if (!parsed.ok) {
        setMessage(`Import refusé : ${parsed.reason}`);
        return;
      }
      await writeAlbum(parsed.album);
      await writeSave(parsed.save);
      window.location.reload();
    });
    input.click();
  };

  return (
    <section id="parent-menu" role="dialog" aria-label="Espace parent">
      <header>
        <h2>Espace parent</h2>
        <div class="choices tabs">
          {(Object.keys(TABS) as Tab[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={tab === option}
              onPointerDown={() => setTab(option)}
            >
              {TABS[option]}
            </button>
          ))}
        </div>
      </header>
      <div class="content">
        {tab === 'progress' && <Progress session={session} day={day} />}
        {tab === 'notions' && (
          <Notions
            session={session}
            recommended={recommended}
            onSettings={onSettings}
            onRecommended={onRecommended}
          />
        )}
        {tab === 'settings' && (
          <div class="tab settings">
            <p>Longueur du sentier</p>
            <div class="choices">
              {(['short', 'normal'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={length === option}
                  onPointerDown={() => onLength(option)}
                >
                  {option === 'short' ? 'Court (6)' : 'Normal (10)'}
                </button>
              ))}
            </div>
            <p>Fait su par cœur : vitesse demandée</p>
            <div class="choices">
              {AUTOMATION_FACTORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={automation === option}
                  onPointerDown={() => {
                    setAutomation(option);
                    onAutomation(option);
                  }}
                >
                  {AUTOMATION_LABELS[option]}
                </button>
              ))}
            </div>
            <p>
              Qualité du rendu
              {chosen === 'auto' && (
                <span class="current"> (en ce moment : {QUALITY_LABELS[current]})</span>
              )}
            </p>
            <div class="choices">
              {(['auto', ...QUALITIES] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={chosen === option}
                  onPointerDown={() => {
                    onQuality(option);
                    setQuality(quality());
                  }}
                >
                  {option === 'auto' ? 'Auto' : QUALITY_LABELS[option]}
                </button>
              ))}
            </div>
            <div class="choices">
              {/* `click`, not `pointerdown`: a file chooser needs a full user activation. */}
              <button type="button" onClick={download}>
                Exporter la sauvegarde
              </button>
              <button type="button" onClick={upload}>
                Importer une sauvegarde
              </button>
            </div>
            {message && <p class="message">{message}</p>}
            {/* Measured on the tablet to calibrate the viewport of the UI tests. */}
            <p class="screen">
              Écran : {window.innerWidth} × {window.innerHeight} px, ×
              {window.devicePixelRatio.toLocaleString('fr', { maximumFractionDigits: 2 })} (
              {screen.width} × {screen.height})
            </p>
          </div>
        )}
      </div>
      <button type="button" class="close" onPointerDown={onClose}>
        Fermer
      </button>
    </section>
  );
}
