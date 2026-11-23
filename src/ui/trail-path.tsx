interface Props {
  stones: number;
  /** The stone in progress; all stones are crossed when it equals `stones`. */
  current: number;
}

/** The trail as a path of stones: the end is always in sight. */
export function TrailPath({ stones, current }: Props) {
  return (
    <ol id="trail" aria-label={`Pierre ${Math.min(current + 1, stones)} sur ${stones}`}>
      {Array.from({ length: stones }, (_, i) => {
        let state = 'ahead';
        if (i < current) state = 'crossed';
        else if (i === current) state = 'here';
        return <li key={`${i}-${state}`} class={`stone ${state}`} />;
      })}
    </ol>
  );
}
