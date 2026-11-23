interface Props {
  stones: number;
  /** The stone in progress; all stones are crossed when it equals `stones`. */
  current: number;
}

const HEIGHT = 56;
const FIRST = 30;
const GAP = 46;
/** From the last stone to the tree at the end of the path. */
const TO_TREE = 42;
/** The path winds gently through the grass. */
const wind = (x: number) => 31 + 5 * Math.sin(x / 34);

/** The trail as a dirt path through the grass, a stone per question, to a tree: the end is always in sight. */
export function TrailPath({ stones, current }: Props) {
  const tree = FIRST + (stones - 1) * GAP + TO_TREE;
  const width = tree + 28;
  let path = `M 0 ${wind(0).toFixed(1)}`;
  for (let x = 6; x <= tree; x += 6) path += ` L ${x} ${wind(x).toFixed(1)}`;
  return (
    <div id="trail" role="img" aria-label={`Pierre ${Math.min(current + 1, stones)} sur ${stones}`}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
        <path class="verge" d={path} />
        <path class="dirt" d={path} />
        {Array.from({ length: stones }, (_, i) => {
          let state = 'ahead';
          if (i < current) state = 'crossed';
          else if (i === current) state = 'here';
          const x = FIRST + i * GAP;
          return (
            <g key={`${i}-${state}`} transform={`translate(${x} ${wind(x).toFixed(1)})`}>
              <g class={`stone ${state}`}>
                <ellipse class="halo" rx="19" ry="13" />
                <ellipse class="rock" rx="14" ry="9" />
                <ellipse class="shine" cx="-4" cy="-3" rx="5" ry="2.4" />
              </g>
            </g>
          );
        })}
        <g class="tree" transform={`translate(${tree} ${wind(tree).toFixed(1)})`}>
          <rect class="trunk" x="-3" y="-6" width="6" height="14" rx="2" />
          <circle class="crown" cx="0" cy="-14" r="11" />
          <circle class="crown" cx="-7" cy="-8" r="7" />
          <circle class="crown" cx="7" cy="-8" r="7" />
        </g>
      </svg>
    </div>
  );
}
