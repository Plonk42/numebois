/** Rank names over the columns of the table, from the thousands. */
const COLUMNS = ['milliers', 'centaines', 'dizaines', 'unités'];

/** The place-value table: one coloured column per rank, a digit (or an empty cell) under it. */
export function PlaceValueFigure({ digits }: { digits: readonly (number | null)[] }) {
  const columns = COLUMNS.slice(COLUMNS.length - digits.length);
  return (
    <div class="place-value" style={{ gridTemplateColumns: `repeat(${digits.length}, 1fr)` }}>
      {columns.map((name, i) => (
        <span key={name} class={`rank r${digits.length - 1 - i}`}>
          {name}
        </span>
      ))}
      {digits.map((digit, i) => (
        <b key={i} class={`r${digits.length - 1 - i}`}>
          {digit ?? ''}
        </b>
      ))}
    </div>
  );
}

const CELL = 5.6;
const PLATE = CELL * 10;
const BAR = 12;
const CUBE = 16;
const GAP = 8;
const BAR_GAP = 4;
const PLATE_COLUMNS = 3;

/** A square of 10 × 10 cells, or a column of 10 cells. */
function Grid({ x, y, columns }: { x: number; y: number; columns: number }) {
  const width = columns === 10 ? PLATE : BAR;
  const lines: string[] = [];
  for (let i = 1; i < 10; i++) {
    lines.push(`M${x} ${y + i * CELL}h${width}`);
    if (columns === 10) lines.push(`M${x + i * CELL} ${y}v${PLATE}`);
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={PLATE} rx={2} />
      <path d={lines.join('')} />
    </g>
  );
}

/**
 * Base-ten blocks, hundreds on the left, tens in the middle, units on the right: plates of
 * 10 × 10 cells in rows of three, bars of 10 cells side by side, cubes three by three.
 */
export function BlocksFigure({
  hundreds,
  tens,
  units,
}: {
  hundreds: number;
  tens: number;
  units: number;
}) {
  const plateRows = Math.ceil(hundreds / PLATE_COLUMNS);
  const height = Math.max(PLATE, plateRows * PLATE + (plateRows - 1) * GAP);
  const platesWidth = Math.min(hundreds, PLATE_COLUMNS) * (PLATE + GAP) - GAP;
  const barsX = platesWidth + 3 * GAP;
  const barsWidth = tens * (BAR + BAR_GAP) - BAR_GAP;
  const cubesX = barsX + barsWidth + 3 * GAP;
  const cubeRows = Math.ceil(units / 3);
  const width = cubesX + Math.min(units, 3) * (CUBE + 6) - 6;
  return (
    <svg class="blocks" viewBox={`-2 -2 ${width + 4} ${height + 4}`}>
      <g class="r2">
        {Array.from({ length: hundreds }, (_, i) => (
          <Grid
            key={i}
            x={(i % PLATE_COLUMNS) * (PLATE + GAP)}
            y={Math.floor(i / PLATE_COLUMNS) * (PLATE + GAP)}
            columns={10}
          />
        ))}
      </g>
      <g class="r1">
        {Array.from({ length: tens }, (_, i) => (
          <Grid key={i} x={barsX + i * (BAR + BAR_GAP)} y={height - PLATE} columns={1} />
        ))}
      </g>
      <g class="r0">
        {Array.from({ length: units }, (_, i) => (
          <rect
            key={i}
            x={cubesX + (i % 3) * (CUBE + 6)}
            y={height - (cubeRows - Math.floor(i / 3)) * (CUBE + 6) + 6}
            width={CUBE}
            height={CUBE}
            rx={2}
          />
        ))}
      </g>
    </svg>
  );
}
