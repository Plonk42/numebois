import { useState } from 'preact/hooks';
import type { TrailLength } from '../core/trail';
import type { Skill } from '../core/types';
import { QUALITIES, QUALITY_LABELS, type Quality } from '../scene/render/quality';
import { parseSave } from '../save/save';
import { writeSave } from '../save/store';

interface Props {
  skills: readonly Skill[];
  length: TrailLength;
  /** Why the save could not be read at start, if it could not. */
  problem: string | null;
  exportSave(): string;
  quality(): { chosen: Quality | 'auto'; current: Quality };
  onQuality(quality: Quality | 'auto'): void;
  onLength(length: TrailLength): void;
  onClose(): void;
}

/** Hidden parent menu (long press on the gauge): trail length, quality, export and import. */
export function ParentMenu({
  skills,
  length,
  problem,
  exportSave,
  quality,
  onQuality,
  onLength,
  onClose,
}: Props) {
  const [message, setMessage] = useState(problem);
  const [{ chosen, current }, setQuality] = useState(quality);

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
      const parsed = parseSave(text, skills);
      if (!parsed.ok) {
        setMessage(`Import refusé : ${parsed.reason}`);
        return;
      }
      await writeSave(text);
      window.location.reload();
    });
    input.click();
  };

  return (
    <section id="parent-menu" role="dialog" aria-label="Espace parent">
      <h2>Espace parent</h2>
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
      {/* `click`, not `pointerdown`: a file chooser needs a full user activation. */}
      <button type="button" onClick={download}>
        Exporter la sauvegarde
      </button>
      <button type="button" onClick={upload}>
        Importer une sauvegarde
      </button>
      {message && <p class="message">{message}</p>}
      {/* Measured on the tablet to calibrate the viewport of the UI tests. */}
      <p class="screen">
        Écran : {window.innerWidth} × {window.innerHeight} px, ×
        {window.devicePixelRatio.toLocaleString('fr', { maximumFractionDigits: 2 })} ({screen.width}{' '}
        × {screen.height})
      </p>
      <button type="button" class="close" onPointerDown={onClose}>
        Fermer
      </button>
    </section>
  );
}
