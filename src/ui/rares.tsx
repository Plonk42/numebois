import type { JSX } from 'preact';
import type { RareName } from '../scene/description';

export const RARE_LABELS: Record<RareName, string> = {
  fireflies: 'Des lucioles',
  rainbow: 'Un arc-en-ciel',
  beavers: 'Des castors',
};

/** Shown while the rare element comes into the painting. */
export const RARE_ARRIVALS: Record<RareName, string> = {
  fireflies: 'Les lucioles arrivent !',
  rainbow: 'Un arc-en-ciel apparaît !',
  beavers: 'Les castors arrivent !',
};

const BANDS = ['#e8584f', '#f39a3c', '#f4d04a', '#69b85a', '#4f8fd8'];

const SHAPES: Record<RareName, JSX.Element> = {
  fireflies: (
    <>
      <circle class="night" cx="32" cy="32" r="28" />
      {[
        [22, 22],
        [42, 18],
        [36, 38],
        [18, 44],
        [48, 44],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle class="halo" cx={x} cy={y} r="7" />
          <circle class="glow" cx={x} cy={y} r="3" />
        </g>
      ))}
    </>
  ),
  rainbow: (
    <>
      {BANDS.map((color, i) => (
        <path
          key={color}
          class="band"
          stroke={color}
          d={`M${8 + i * 4} 50a${24 - i * 4} ${24 - i * 4} 0 0 1 ${48 - i * 8} 0`}
        />
      ))}
    </>
  ),
  beavers: (
    <>
      <path class="water" d="M4 44h56v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      {[
        [10, 40, 44],
        [14, 31, 36],
        [20, 22, 24],
      ].map(([x, y, length]) => (
        <g key={y}>
          <rect class="log" x={x} y={y} width={length} height="9" rx="4.5" />
          <circle class="cut" cx={x + length - 4.5} cy={y + 4.5} r="3" />
        </g>
      ))}
    </>
  ),
};

/** A rare element in one picture: fireflies at night, a rainbow, the beavers' dam. */
export function RareIcon({ rare }: { rare: RareName }) {
  return (
    <svg class={`rare-icon ${rare}`} viewBox="0 0 64 64" aria-hidden="true">
      {SHAPES[rare]}
    </svg>
  );
}
