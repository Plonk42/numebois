import { TRAIL_ZOOM, type TrailArt } from '../scene/render/trail-art';

interface Props {
  /** Drawn with the models of the forest; nothing shows while they load. */
  art: TrailArt | null;
  stones: number;
  /** The stone in progress; all stones are crossed when it equals `stones`. */
  current: number;
  /**
   * Between two trails, the trail waits big at the bottom, a wooden sign at its start: a
   * touch on it starts the trail, which climbs to the top of the screen.
   */
  start?: { label: string; onStart(): void };
  /** Out of sight at the bottom while the shop has the forest. */
  aside?: boolean;
}

/**
 * The trail as a tiny diorama of the forest: a dirt path through the grass, a stepping stone
 * per question, to a tree: the end is always in sight.
 */
export function TrailPath({ art, stones, current, start, aside }: Props) {
  const label = start?.label ?? `Pierre ${Math.min(current + 1, stones)} sur ${stones}`;
  let place = 'top';
  if (start) place = 'start';
  else if (aside) place = 'aside';
  if (!art) return <div id="trail" class={place} role="img" aria-label={label} />;
  const { path, sign } = art;
  const [first, ...rest] = (start?.label ?? '').split(' ');
  return (
    <div
      id="trail"
      class={place}
      role={start ? 'button' : 'img'}
      aria-label={label}
      style={{ width: `${path.width}px`, height: `${path.height}px`, '--small': 1 / TRAIL_ZOOM }}
      onPointerDown={start?.onStart}
    >
      <div
        class="sign"
        style={{
          left: `${art.start[0] - sign.foot[0]}px`,
          top: `${art.start[1] - sign.foot[1]}px`,
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
