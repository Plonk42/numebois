import type { TrailArt } from '../scene/render/trail-art';

interface Props {
  /** Drawn with the models of the forest; nothing shows while they load. */
  art: TrailArt | null;
  stones: number;
  /** The stone in progress; all stones are crossed when it equals `stones`. */
  current: number;
  /** At the end of the trail, a wooden sign at the start of the path begins another one. */
  onNewTrail?: () => void;
}

const SIGN_GAP = 4;

/**
 * The trail as a tiny diorama of the forest: a dirt path through the grass, a stepping stone
 * per question, to a tree: the end is always in sight.
 */
export function TrailPath({ art, stones, current, onNewTrail }: Props) {
  const label = `Pierre ${Math.min(current + 1, stones)} sur ${stones}`;
  if (!art) return <div id="trail" role="img" aria-label={label} />;
  const { path, sign } = art;
  return (
    <>
      {onNewTrail && (
        <button
          type="button"
          id="new-trail"
          aria-label="Nouveau sentier"
          style={{
            right: `calc(50% + ${path.width / 2 + SIGN_GAP}px)`,
            width: `${sign.width}px`,
            height: `${sign.height}px`,
          }}
          onPointerDown={onNewTrail}
        >
          <img src={sign.url} alt="" draggable={false} />
          <span
            style={{
              left: `${sign.label.x}px`,
              top: `${sign.label.y}px`,
              width: `${sign.label.width}px`,
              height: `${sign.label.height}px`,
            }}
          >
            Nouveau
            <br />
            sentier
          </span>
        </button>
      )}
      <div
        id="trail"
        role="img"
        aria-label={label}
        style={{ width: `${path.width}px`, height: `${path.height}px` }}
      >
        <img class="land" src={path.url} alt="" draggable={false} />
        {art.stones.slice(0, stones).map(([x, y], i) => {
          let state: keyof TrailArt['stone'] = 'ahead';
          if (i < current) state = 'crossed';
          else if (i === current) state = 'here';
          const sprite = art.stone[state];
          return (
            <img
              key={`${i}-${state}`}
              class={`stone ${state}`}
              src={sprite.url}
              alt=""
              draggable={false}
              style={{
                left: `${x - sprite.width / 2}px`,
                top: `${y - sprite.height / 2}px`,
                width: `${sprite.width}px`,
                height: `${sprite.height}px`,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
