import { useEffect, useRef } from 'preact/hooks';
import { CharacterView, type Mood } from '../scene/character';
import { PLUME, SQUIRREL, type Character } from '../scene/characters';

export type { Mood };

let view: CharacterView | null = null;

/** One canvas for the whole game: the slate and the cards take it in turn. */
function characterView(): CharacterView {
  view ??= new CharacterView(import.meta.env.BASE_URL);
  return view;
}

function Actor({ character, mood }: { character: Character; mood: Mood }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    characterView().attach(element, character);
    return () => characterView().detach(element);
  }, [character]);
  useEffect(() => characterView().setMood(mood), [mood]);
  return <div ref={host} class={`character ${character.name} ${mood}`} aria-hidden="true" />;
}

/**
 * Plume the owl, perched on the edge of the slate: calm during a question, tilting her head
 * when she gives a hint, hopping for joy after a right answer.
 */
export function Plume({ mood }: { mood: Mood }) {
  return <Actor character={PLUME} mood={mood} />;
}

/** The squirrel of the challenges, in Plume's place: he holds out his acorn to offer one. */
export function Squirrel({ mood }: { mood: Mood }) {
  return <Actor character={SQUIRREL} mood={mood} />;
}
