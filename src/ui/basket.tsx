import { useRef } from 'preact/hooks';
import { LeafIcon, plural, useLanding } from './reserve';

interface Props {
  /** Leaves of the trail in progress, already saved in the reserve. */
  leaves: number;
  /** At the end of the trail, Plume pours them into the reserve. */
  pouring: boolean;
}

/** Plume's basket, at her feet: each right answer of the trail sends a leaf into it. */
export function Basket({ leaves, pouring }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, flights] = useLanding('leaf', leaves, '#question .praise', ref);
  return (
    <div
      ref={ref}
      class={`basket${pouring ? ' pouring' : ''}`}
      role="img"
      aria-label={`Panier : ${plural(leaves, 'feuille', 'feuilles')}`}
    >
      {shown > 0 && (
        <span class="heap">
          <LeafIcon />
          <LeafIcon />
        </span>
      )}
      <svg class="wicker" viewBox="0 0 80 56" aria-hidden="true">
        <path class="handle" d="M16 24C16 2 64 2 64 24" />
        <path class="body" d="M6 22h68l-8 32H14z" />
        <path class="weave" d="M9 32h62M11 42h58M26 22l2 32M40 22v32M54 22l-2 32" />
      </svg>
      {shown > 0 && <b key={shown}>{shown}</b>}
      {flights}
    </div>
  );
}
