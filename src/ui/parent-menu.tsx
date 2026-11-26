import { useState } from 'preact/hooks';
import { cleanName, MAX_NAME_LENGTH } from '../core/name';
import type { Session } from '../core/session';
import type { SkillSetting } from '../core/settings';
import type { TrailLength } from '../core/trail';
import type { Lesson, Skill, SkillId } from '../core/types';
import { QUALITIES, QUALITY_LABELS, type Quality } from '../scene/render/quality';
import { importFile } from '../save/album';
import { AUTOMATION_FACTORS, type NotebookChoice, type Recommended } from '../save/parent';
import { writeAlbum, writeSave } from '../save/store';
import { Homework, Notions, Progress } from './dashboard';
import type { Requests } from '../core/homework';

type Tab = 'progress' | 'notions' | 'homework' | 'settings';
const TABS: Record<Tab, string> = {
  progress: 'Suivi',
  notions: 'Notions',
  homework: 'Devoirs',
  settings: 'Réglages',
};

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
  /** The child's first name (#138), empty when not given. */
  name: string;
  onName(name: string): void;
  /** Why the save could not be read at start, if it could not. */
  problem: string | null;
  exportSave(): string;
  quality(): { chosen: Quality | 'auto'; current: Quality };
  onQuality(quality: Quality | 'auto'): void;
  onLength(length: TrailLength): void;
  onSettings(settings: Map<SkillId, SkillSetting>): void;
  onAutomation(factor: number): void;
  /** The squirrel offers the long challenges too (#132). */
  onLongChallenges(open: boolean): void;
  onRecommended(recommended: Recommended | null): void;
  /** The homework of the week (#54): astuces and challenges the parent may ask for. */
  lessons: readonly Lesson[];
  challenges: readonly Skill[];
  requests: Requests;
  onRequests(requests: Requests): void;
  notebookChoices: readonly NotebookChoice[];
  onNotebookChoices(choices: NotebookChoice[]): void;
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
  name,
  onName,
  problem,
  exportSave,
  quality,
  onQuality,
  onLength,
  onSettings,
  onAutomation,
  onLongChallenges,
  onRecommended,
  lessons,
  challenges,
  requests,
  onRequests,
  notebookChoices,
  onNotebookChoices,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(problem ? 'settings' : 'progress');
  const [message, setMessage] = useState(problem);
  const [{ chosen, current }, setQuality] = useState(quality);
  const [automation, setAutomation] = useState(session.automation);
  const [long, setLong] = useState(session.longChallenges);
  const [typedName, setTypedName] = useState(name);

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
        {tab === 'notions' && <Notions session={session} onSettings={onSettings} />}
        {tab === 'homework' && (
          <Homework
            session={session}
            day={day}
            lessons={lessons}
            challenges={challenges}
            requests={requests}
            onRequests={onRequests}
            notebookChoices={notebookChoices}
            onNotebookChoices={onNotebookChoices}
            recommended={recommended}
            onRecommended={onRecommended}
            onSettings={onSettings}
          />
        )}
        {tab === 'settings' && (
          <div class="tab settings">
            <label class="name">
              Prénom de l’enfant, gardé sur la tablette (vide : Plume le demande au lancement)
              <input
                type="text"
                value={typedName}
                maxLength={MAX_NAME_LENGTH}
                autocomplete="off"
                spellcheck={false}
                // Kept at each letter: the menu may close before the field loses focus.
                onInput={(event) => {
                  setTypedName(event.currentTarget.value);
                  onName(cleanName(event.currentTarget.value));
                }}
                onBlur={() => setTypedName(cleanName(typedName))}
              />
            </label>
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
            <p>Défis longs : panier de 1 min 30, course de 20 questions</p>
            <div class="choices">
              {[false, true].map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  aria-pressed={long === option}
                  onPointerDown={() => {
                    setLong(option);
                    onLongChallenges(option);
                  }}
                >
                  {option ? 'Proposés' : 'Non proposés'}
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
            <p class="version">Version : {__COMMIT__}</p>
          </div>
        )}
      </div>
      <button type="button" class="close" onPointerDown={onClose}>
        Fermer
      </button>
    </section>
  );
}
