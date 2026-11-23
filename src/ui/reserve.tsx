import type { RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Hold the reserve this long to open the parent menu. */
const LONG_PRESS_MS = 1500;
const FLIGHT_MS = 750;

export function LeafIcon() {
  return (
    <svg class="leaf-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" />
      <path class="vein" d="M5 19L15 9" />
    </svg>
  );
}

export function SeedIcon() {
  return (
    <svg class="seed-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5C8.2 7.2 5.5 11.4 5.5 15.2a6.5 6.5 0 0 0 13 0c0-3.8-2.7-8-6.5-12.7z" />
      <path class="shine" d="M9.2 13.2c.3-2 1.3-4 2.6-5.8" />
    </svg>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

interface Flight {
  id: number;
  kind: 'leaf' | 'seed';
  from: DOMRect;
  /** The count once it has landed. */
  value: number;
}

/** A leaf or a seed flying from where it was earned to its counter, then gone. */
function Flying({ flight, to, onLanded }: { flight: Flight; to: Element; onLanded(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = to.getBoundingClientRect();
    const { from } = flight;
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const x1 = target.left + target.width / 2;
    const y1 = target.top + target.height / 2;
    // An arc: up and out first, then into the counter.
    const mx = (x0 + x1) / 2;
    const my = Math.min(y0, y1) - 60;
    const animation = ref.current!.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.4) rotate(-40deg)`, opacity: 0.4 },
        { transform: `translate(${mx}px, ${my}px) scale(1.5) rotate(20deg)`, opacity: 1 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.9) rotate(0deg)`, opacity: 1 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
    );
    animation.onfinish = onLanded;
    return () => animation.cancel();
  }, []);
  return (
    <div ref={ref} class={`flying ${flight.kind}`}>
      {flight.kind === 'leaf' ? <LeafIcon /> : <SeedIcon />}
    </div>
  );
}

/**
 * A count fed by flights: when it grows, a leaf or a seed flies from `source` to `target` and
 * the shown count follows when it lands; spent, or nowhere to fly from, it follows at once.
 */
export function useLanding(
  kind: Flight['kind'],
  value: number,
  source: string,
  target: RefObject<Element | null>,
) {
  const [shown, setShown] = useState(value);
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextId = useRef(0);
  const latest = useRef(value);
  useLayoutEffect(() => {
    const grew = value > latest.current;
    latest.current = value;
    const from = grew ? document.querySelector(source)?.getBoundingClientRect() : undefined;
    if (from) setFlights((list) => [...list, { id: nextId.current++, kind, from, value }]);
    else setShown(value);
  }, [value]);
  // Fixed over the whole screen, out of the slate or the card, which move.
  const flying = createPortal(
    <>
      {flights.map((flight) => (
        <Flying
          key={flight.id}
          flight={flight}
          to={target.current!}
          onLanded={() => {
            setFlights((list) => list.filter((f) => f.id !== flight.id));
            setShown(Math.min(flight.value, latest.current));
          }}
        />
      ))}
    </>,
    document.body,
  );
  return [shown, flying] as const;
}

interface Props {
  /** In the reserve, the leaves of the trail in progress still in Plume's basket aside. */
  leaves: number;
  seeds: number;
  /** Something can be bought: the reserve glows. */
  ready: boolean;
  onTap(): void;
  onLongPress(): void;
}

/**
 * The reserve, top left: leaves and golden seeds, never lost. The leaves come from Plume's
 * basket, the golden seeds from where they were won, and the counter pops when they land.
 * At the end of the trail, a touch opens the shop.
 */
export function Reserve({ leaves, seeds, ready, onTap, onLongPress }: Props) {
  const timer = useRef(0);
  const pressedAt = useRef<number | null>(null);
  const leafCounter = useRef<HTMLSpanElement>(null);
  const seedCounter = useRef<HTMLSpanElement>(null);
  const [shownLeaves, leafFlights] = useLanding('leaf', leaves, '.basket', leafCounter);
  const [shownSeeds, seedFlights] = useLanding('seed', seeds, '#seed-gift .seed-icon', seedCounter);

  const cancel = () => {
    clearTimeout(timer.current);
    pressedAt.current = null;
  };
  const open = () => {
    cancel();
    onLongPress();
  };
  return (
    <>
      <div
        id="reserve"
        class={ready ? 'ready' : ''}
        role="img"
        aria-label={`Réserve : ${plural(leaves, 'feuille', 'feuilles')}, ${plural(seeds, 'graine dorée', 'graines dorées')}`}
        onPointerDown={(event) => {
          cancel();
          pressedAt.current = event.timeStamp;
          timer.current = window.setTimeout(open, LONG_PRESS_MS);
          onTap();
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
        <span class="counter leaves" ref={leafCounter}>
          <LeafIcon />
          <b key={shownLeaves}>{shownLeaves}</b>
        </span>
        <span class="counter seeds" ref={seedCounter}>
          <SeedIcon />
          <b key={shownSeeds}>{shownSeeds}</b>
        </span>
      </div>
      {leafFlights}
      {seedFlights}
    </>
  );
}
