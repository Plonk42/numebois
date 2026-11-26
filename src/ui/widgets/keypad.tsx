import { useEffect, useRef, useState } from 'preact/hooks';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'submit'] as const;
/** In two rows under a wide work area (a ruler). */
const ROW_KEYS = ['1', '2', '3', '4', '5', 'erase', '6', '7', '8', '9', '0', 'submit'] as const;
const SPECIAL = {
  erase: { text: '⌫', label: 'Effacer' },
  submit: { text: '✓', label: 'Valider' },
} as const;

/** Digits grouped as written at school, leading zeros kept: 3 240. */
export function grouped(entry: string): string {
  return entry.length > 3 ? `${entry.slice(0, -3)}\u202f${entry.slice(-3)}` : entry;
}

export type Key = (typeof KEYS)[number];

/**
 * The entry typed on the keypad, and on the digit, Backspace and Enter keys: never the
 * Android keyboard.
 */
export function useEntry(maxDigits: number, locked: boolean, onSubmit: (answer: string) => void) {
  const [entry, setEntry] = useState('');
  // Fast typing comes before the next render: read and write the latest entry here.
  const latest = useRef('');

  const press = (key: Key) => {
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
      if (/^\d$/.test(event.key)) pressRef.current(event.key as Key);
      else if (event.key === 'Backspace') pressRef.current('erase');
      else if (event.key === 'Enter') pressRef.current('submit');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { entry, press };
}

interface AnswerProps {
  entry: string;
  /** The entry is right: shown in green. */
  right: boolean;
  /** The expected answer, shown in place of the entry. */
  shown: string | null;
  /** The entry is the one just tried, not right yet: a soft colour until it changes. */
  tried?: boolean;
  /** In the operation, as wide as the longest answer: an empty box waits for it. */
  inline?: { maxDigits: number };
}

/** Where the typed number is written. */
export function Answer({ entry, right, shown, tried, inline }: AnswerProps) {
  let state = '';
  if (right) state = ' right';
  else if (shown !== null) state = ' shown';
  else if (tried) state = ' tried';
  else if (inline) state = entry ? ' placed' : ' empty';
  return (
    <output
      class={`answer${inline ? ' inline' : ''}${state}`}
      style={inline && `--digits: ${inline.maxDigits}`}
      aria-label={shown === null ? 'Ta réponse' : 'La réponse'}
    >
      {grouped(shown ?? entry)}
    </output>
  );
}

/** Number pad of the game: reacts as soon as the finger touches. */
export function Keypad({
  ready,
  locked,
  press,
  rows = false,
}: {
  /** Something to submit: the ✓ key wakes up. */
  ready: boolean;
  /** The answer is checked: the keys wait. */
  locked: boolean;
  press(key: Key): void;
  /** Two rows of six keys, under a wide work area. */
  rows?: boolean;
}) {
  return (
    <div class={rows ? 'keypad rows' : 'keypad'}>
      {(rows ? ROW_KEYS : KEYS).map((key) => {
        const special = key === 'erase' || key === 'submit' ? SPECIAL[key] : null;
        return (
          <button
            key={key}
            type="button"
            class={`key ${special ? key : 'digit'}`}
            disabled={locked || (key === 'submit' && !ready)}
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
  );
}
