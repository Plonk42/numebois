export type PlumeMood = 'calm' | 'talk' | 'cheer';

/**
 * Plume the owl, perched on the edge of the slate: calm during a question, talking when she
 * gives a hint, cheering after a right answer. A stand-in drawing until her model (#26).
 */
export function Plume({ mood }: { mood: PlumeMood }) {
  return (
    <svg class={`plume ${mood}`} viewBox="0 0 100 112" aria-hidden="true">
      <g class="feet">
        <ellipse cx="38" cy="106" rx="7" ry="4" />
        <ellipse cx="62" cy="106" rx="7" ry="4" />
      </g>
      <g class="dark">
        <polygon points="16,34 22,6 38,26" />
        <polygon points="84,34 78,6 62,26" />
        <ellipse class="wing left" cx="12" cy="70" rx="9" ry="20" />
        <ellipse class="wing right" cx="88" cy="70" rx="9" ry="20" />
      </g>
      <ellipse class="body" cx="50" cy="62" rx="40" ry="44" />
      <ellipse class="belly" cx="50" cy="80" rx="27" ry="23" />
      <path class="chevrons" d="M40 76l3 3 3-3M54 76l3 3 3-3M47 86l3 3 3-3" />
      <circle class="eye" cx="33" cy="47" r="16" />
      <circle class="eye" cx="67" cy="47" r="16" />
      <g class="look">
        <circle class="pupil" cx="34" cy="48" r="8.5" />
        <circle class="pupil" cx="66" cy="48" r="8.5" />
        <circle class="glint" cx="37" cy="44.5" r="2.8" />
        <circle class="glint" cx="69" cy="44.5" r="2.8" />
      </g>
      <polygon class="beak" points="45,58 55,58 50,68" />
    </svg>
  );
}
