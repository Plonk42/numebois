import { useEffect, useRef, useState } from 'preact/hooks';
import { grouped } from './keypad';

interface Props {
  options: readonly string[];
  /** The answer is checked: the choices wait. */
  locked: boolean;
  /** The last choice is right: shown in green. */
  right: boolean;
  /** The expected answer, outlined in yellow. */
  shown: string | null;
  onSubmit(answer: string): void;
}

/**
 * Choice among a few answers, one touch: reacts as soon as the finger touches. A choice
 * already tried stays dimmed, never red. Keyboard: 1 to 4, or the sign itself.
 */
export function Choice({ options, locked, right, shown, onSubmit }: Props) {
  const [tried, setTried] = useState<readonly string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const choose = (option: string) => {
    if (locked || tried.includes(option)) return;
    setLast(option);
    setTried([...tried, option]);
    onSubmit(option);
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      const option = options.includes(event.key) ? event.key : options[index];
      if (option === undefined) return;
      event.preventDefault();
      chooseRef.current(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options]);

  const short = options.every((option) => option.length <= 2);
  // A keypad answer offered among choices: big numbers, two by two.
  const numbers = options.every((option) => /^\d+$/.test(option));
  let layout = '';
  if (numbers) layout = options.some((option) => option.length > 4) ? ' numbers long' : ' numbers';
  else if (short) layout = ' signs';
  return (
    <div class={`choice${layout}`}>
      {options.map((option) => {
        let state = '';
        if (right && option === last) state = 'right';
        else if (option === shown) state = 'shown';
        else if (tried.includes(option)) state = 'tried';
        return (
          <button
            key={option}
            type="button"
            class={state}
            disabled={locked && state !== 'right' && state !== 'shown'}
            onPointerDown={() => choose(option)}
          >
            {numbers ? grouped(option) : option}
          </button>
        );
      })}
    </div>
  );
}
