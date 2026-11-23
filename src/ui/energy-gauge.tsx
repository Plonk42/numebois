import { useRef } from 'preact/hooks';
import { ENERGY_PER_ELEMENT } from '../core/energy';

const LEAF = 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15z';
const VEIN = 'M5 19L15 9';
/** Hold the gauge this long to open the parent menu. */
const LONG_PRESS_MS = 1500;

interface Props {
  energy: number;
  onLongPress(): void;
}

/** One leaf per right answer; a full branch grows a new element in the forest. */
export function EnergyGauge({ energy, onLongPress }: Props) {
  const full = energy >= ENERGY_PER_ELEMENT;
  const timer = useRef(0);
  const pressedAt = useRef<number | null>(null);
  const cancel = () => {
    clearTimeout(timer.current);
    pressedAt.current = null;
  };
  const open = () => {
    cancel();
    onLongPress();
  };
  return (
    <div
      id="energy"
      class={full ? 'full' : ''}
      role="img"
      aria-label={`Énergie : ${energy} sur ${ENERGY_PER_ELEMENT}`}
      onPointerDown={(event) => {
        cancel();
        pressedAt.current = event.timeStamp;
        timer.current = window.setTimeout(open, LONG_PRESS_MS);
      }}
      // A busy page can fire the timer late: the hold time decides, measured on the events.
      onPointerUp={(event) => {
        const held = pressedAt.current !== null && event.timeStamp - pressedAt.current;
        if (held !== false && held >= LONG_PRESS_MS) open();
        else cancel();
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      {Array.from({ length: ENERGY_PER_ELEMENT }, (_, i) => (
        <span key={`${i}-${i < energy}`} class={`leaf${i < energy ? ' on' : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={LEAF} />
            <path class="vein" d={VEIN} />
          </svg>
        </span>
      ))}
    </div>
  );
}
