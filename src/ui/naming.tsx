import { useEffect, useRef, useState } from 'preact/hooks';
import { cleanName, MAX_NAME_LENGTH } from '../core/name';
import { Plume } from './character';

/**
 * At launch, while the child has no first name (#138): Plume asks it, at the top of the screen
 * so that the tablet's keyboard leaves the field in sight. « Plus tard » plays without it.
 */
export function Naming({ onDone }: { onDone(name: string): void }) {
  const [typed, setTyped] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const answered = useRef(false);
  useEffect(() => field.current?.focus(), []);
  const finish = (name: string) => {
    if (answered.current) return;
    answered.current = true;
    field.current?.blur();
    onDone(name);
  };
  return (
    <section id="naming" class="card" aria-label="Ton prénom">
      <Plume mood="talk" />
      <p class="praise">Bonjour ! Moi, c’est Plume.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          finish(cleanName(typed));
        }}
      >
        <label>
          <span class="instruction">Et toi, comment t’appelles-tu ?</span>
          <input
            ref={field}
            type="text"
            value={typed}
            maxLength={MAX_NAME_LENGTH}
            autocomplete="off"
            autocapitalize="words"
            spellcheck={false}
            enterKeyHint="done"
            onInput={(event) => setTyped(event.currentTarget.value)}
          />
        </label>
        <div class="actions">
          <button type="button" class="next" onPointerDown={() => finish(cleanName(typed))}>
            C’est moi !
          </button>
          <button type="button" onPointerDown={() => finish('')}>
            Plus tard
          </button>
        </div>
      </form>
    </section>
  );
}
