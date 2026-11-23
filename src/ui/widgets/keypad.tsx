import { useEffect, useRef, useState } from 'preact/hooks';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'submit'] as const;
const SPECIAL = {
  erase: { text: '⌫', label: 'Effacer' },
  submit: { text: '✓', label: 'Valider' },
} as const;

/** Digits grouped as written at school, leading zeros kept: 3 240. */
export function grouped(entry: string): string {
  return entry.length > 3 ? `${entry.slice(0, -3)}\u202f${entry.slice(-3)}` : entry;
}

interface Props {
  maxDigits: number;
  /** The answer is checked: the keys wait. */
  locked: boolean;
  /** The entry is right: shown in green. */
  right: boolean;
  onSubmit(answer: string): void;
}

/**
 * Number pad of the game, never the Android keyboard: reacts as soon as the finger
 * touches, and to the digit, Backspace and Enter keys.
 */
export function Keypad({ maxDigits, locked, right, onSubmit }: Props) {
  const [entry, setEntry] = useState('');
  // Fast typing comes before the next render: read and write the latest entry here.
  const latest = useRef('');

  const press = (key: (typeof KEYS)[number]) => {
    if (locked) return;
    const value = latest.current;
    if (key === 'submit') {
      if (value) onSubmit(value);
      return;
    }
    let next = value;
    if (key === 'erase') next = value.slice(0, -1);
    else if (value.length < maxDigits) next = value + key;
    latest.current = next;
    setEntry(next);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) pressRef.current(event.key as (typeof KEYS)[number]);
      else if (event.key === 'Backspace') pressRef.current('erase');
      else if (event.key === 'Enter') pressRef.current('submit');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <output class={`answer${right ? ' right' : ''}`} aria-label="Ta réponse">
        {grouped(entry)}
      </output>
      <div class="keypad">
        {KEYS.map((key) => {
          const special = key === 'erase' || key === 'submit' ? SPECIAL[key] : null;
          return (
            <button
              key={key}
              type="button"
              class={`key ${special ? key : 'digit'}`}
              disabled={locked || (key === 'submit' && !entry)}
              aria-label={special?.label ?? key}
              onPointerDown={(event) => {
                event.preventDefault();
                press(key);
              }}
            >
              {special?.text ?? key}
            </button>
          );
        })}
      </div>
    </>
  );
}
