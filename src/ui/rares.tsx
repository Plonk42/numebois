import type { JSX } from 'preact';
import type { RareName } from '../scene/description';

export const RARE_LABELS: Record<RareName, string> = {
  fireflies: 'Des lucioles',
  rainbow: 'Un arc-en-ciel',
  beavers: 'Des castors',
  windmill: 'Un moulin',
  balloon: 'Une montgolfière',
  eagles: 'Des aigles',
};

/** Shown while the rare element comes into the painting. */
export const RARE_ARRIVALS: Record<RareName, string> = {
  fireflies: 'Les lucioles arrivent !',
  rainbow: 'Un arc-en-ciel apparaît !',
  beavers: 'Les castors arrivent !',
  windmill: 'Le moulin arrive !',
  balloon: 'La montgolfière arrive !',
  eagles: 'Les aigles arrivent !',
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
  windmill: (
    <>
      <path class="tower" d="M24 58l4-30h8l4 30z" />
      <path class="roof" d="M25 29l7-9 7 9z" />
      {[45, 135, 225, 315].map((a) => (
        <path key={a} class="sail" d="M32 24l3-19h-6z" transform={`rotate(${a} 32 24)`} />
      ))}
      <circle class="hub" cx="32" cy="24" r="3" />
    </>
  ),
  balloon: (
    <>
      <path
        class="envelope"
        d="M32 4c-12 0-19 8-19 18 0 9 8 15 14 22h10c6-7 14-13 14-22 0-10-7-18-19-18z"
      />
      <path class="stripe" d="M32 4c-5 4-7 11-7 18 0 8 2 15 2 22h10c0-7 2-14 2-22 0-7-2-14-7-18z" />
      <path class="rope" d="M27 44l1 8M37 44l-1 8" />
      <rect class="gondola" x="26" y="52" width="12" height="8" rx="2" />
    </>
  ),
  eagles: (
    <>
      <path class="peak" d="M4 60l18-26 8 9 10-17 20 34z" />
      <path class="snowcap" d="M35.3 34L40 26l4.7 8-2.4-1.6-2.3 2.4-2.3-2.4z" />
      {[
        [20, 14, 1.1],
        [51, 12, 0.75],
      ].map(([x, y, k]) => (
        <path
          key={x}
          class="eagle"
          transform={`translate(${x} ${y}) scale(${k})`}
          d="M-14 0c5-4 10-4 14 1 4-5 9-5 14-1-5 0-9 2-14 6-5-4-9-6-14-6z"
        />
      ))}
    </>
  ),
};

/** A rare element in one picture: fireflies at night, a rainbow, the beavers' dam, a windmill, a balloon, eagles. */
export function RareIcon({ rare }: { rare: RareName }) {
  return (
    <svg class={`rare-icon ${rare}`} viewBox="0 0 64 64" aria-hidden="true">
      {SHAPES[rare]}
    </svg>
  );
}
