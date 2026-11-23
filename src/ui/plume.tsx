import { useEffect, useRef } from 'preact/hooks';
import { PlumeView, type PlumeMood } from '../scene/plume';

export type { PlumeMood };

let view: PlumeView | null = null;

/** One Plume for the whole game: the slate and the end of the trail take her in turn. */
function plumeView(): PlumeView {
  if (!view) {
    view = new PlumeView();
    view.load(import.meta.env.BASE_URL).catch((error: unknown) => console.warn('Plume', error));
  }
  return view;
}

/**
 * Plume the owl, perched on the edge of the slate: calm during a question, tilting her head
 * when she gives a hint, hopping for joy after a right answer.
 */
export function Plume({ mood }: { mood: PlumeMood }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    plumeView().attach(element);
    return () => plumeView().detach(element);
  }, []);
  useEffect(() => plumeView().setMood(mood), [mood]);
  return <div ref={host} class={`plume ${mood}`} aria-hidden="true" />;
}
