import { TRAIL_ZOOM, type TrailArt } from '../scene/render/trail-art';

/** The name of the trail, painted on its sign. */
export const TRAIL_NAME = 'Chemin du progrès';

interface Props {
  /** Drawn with the models of the forest; nothing shows while they load. */
  art: TrailArt | null;
  stones: number;
  /** The stone in progress; all stones are crossed when it equals `stones`. */
  current: number;
  /** Between two trails, the trail waits big, its sign on its left: a touch starts it. */
  onStart?: () => void;
  /** Out of sight while the shop, the finale or the Album has the screen. */
  aside?: boolean;
}

/**
 * The trail as a tiny diorama of the forest, always at the bottom of the screen: a dirt path
 * through the grass, a stepping stone per question, to a tree: the end is always in sight.
 * Small during a trail; between two trails, bigger, with its sign: the way on.
 */
export function TrailPath({ art, stones, current, onStart, aside }: Props) {
  const label = onStart ? TRAIL_NAME : `Pierre ${Math.min(current + 1, stones)} sur ${stones}`;
  let place = 'small';
  if (onStart) place = 'start';
  else if (aside) place = 'aside';
  if (!art) return <div id="trail" class={place} role="img" aria-label={label} />;
  const { path, plot, sign } = art;
  const [first, ...rest] = TRAIL_NAME.split(' ');
  return (
    <div
      id="trail"
      class={place}
      role={onStart ? 'button' : 'img'}
      aria-label={label}
      style={{
        width: `${path.width}px`,
        height: `${path.height}px`,
        '--small': 1 / TRAIL_ZOOM,
        '--plot': `${plot.width}px`,
      }}
      onPointerDown={onStart}
    >
      <div
        class="sign"
        style={{
          left: `${-plot.width}px`,
          width: `${plot.width}px`,
          height: `${plot.height}px`,
        }}
      >
        <img src={plot.url} alt="" draggable={false} />
        <div
          class="plank"
          style={{
            left: `${sign.left}px`,
            top: `${sign.top}px`,
            width: `${sign.width}px`,
            height: `${sign.height}px`,
            transformOrigin: `${sign.foot[0]}px ${sign.foot[1]}px`,
          }}
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
            {first}
            <br />
            {rest.join(' ')}
          </span>
        </div>
      </div>
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
  );
}
