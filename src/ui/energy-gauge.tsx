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
  const release = () => clearTimeout(timer.current);
  return (
    <div
      id="energy"
      class={full ? 'full' : ''}
      role="img"
      aria-label={`Énergie : ${energy} sur ${ENERGY_PER_ELEMENT}`}
      onPointerDown={() => {
        release();
        timer.current = window.setTimeout(onLongPress, LONG_PRESS_MS);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
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
