import { MONTHS, clockText, daysIn, durationText, weekday } from '../../core/time';

const WIDTH = 430;
const HEIGHT = 196;
const PAD = 48;
const AXIS_Y = 118;
/** No jump shorter than this, so its ends and their times stay apart (#166). */
const MIN_JUMP = 72;

/** Where each mark stands: jumps as long as their duration, none shorter than `MIN_JUMP`. */
function positions(marks: readonly number[]): number[] {
  const total = WIDTH - 2 * PAD;
  const lengths = marks.slice(1).map((b, i) => b - marks[i]);
  const short = new Set<number>();
  const sized = () => {
    const free = total - short.size * MIN_JUMP;
    const rest = lengths.reduce((sum, length, i) => (short.has(i) ? sum : sum + length), 0);
    return lengths.map((length, i) => (short.has(i) ? MIN_JUMP : (length / rest) * free));
  };
  const tooShort = (width: number, i: number) => !short.has(i) && width < MIN_JUMP;
  let widths = sized();
  for (let i = widths.findIndex(tooShort); i >= 0; i = widths.findIndex(tooShort)) {
    short.add(i);
    widths = sized();
  }
  let x = PAD;
  return [PAD, ...widths.map((width) => (x += width))];
}

/**
 * The timeline (frise) of a duration (#56, #166): the start and the end under the line, a jump
 * over it to each stop between them, without its length: the child counts each jump. When the
 * end is asked, a single jump with its duration, and a « ? » at its end.
 */
export function TimelineFigure({
  start,
  end,
  stops,
  asked,
}: {
  start: number;
  end: number;
  stops: readonly number[];
  asked: 'duration' | 'end';
}) {
  const marks = [start, ...stops, end];
  const at = positions(marks);
  const x = (t: number) => at[marks.indexOf(t)];
  const jump = (a: number, b: number) => {
    const height = Math.min(64, 18 + (x(b) - x(a)) / 4);
    return `M${x(a)} ${AXIS_Y - 6} Q${(x(a) + x(b)) / 2} ${AXIS_Y - 6 - 2 * height} ${x(b)} ${AXIS_Y - 6}`;
  };
  return (
    <svg class="timeline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Frise">
      <line class="axis" x1={PAD - 24} x2={WIDTH - PAD + 24} y1={AXIS_Y} y2={AXIS_Y} />
      {marks.slice(1).map((b, i) => (
        <path key={b} class="jump" d={jump(marks[i], b)} />
      ))}
      {asked === 'end' && (
        <text class="length" x={(x(start) + x(end)) / 2} y={AXIS_Y - 80}>
          {durationText(end - start)}
        </text>
      )}
      {stops.map((t) => (
        <g key={t}>
          <line class="tick" x1={x(t)} x2={x(t)} y1={AXIS_Y - 12} y2={AXIS_Y + 12} />
          <text class="hour" x={x(t)} y={AXIS_Y + 66}>
            {clockText(t)}
          </text>
        </g>
      ))}
      {[start, end].map((t) => (
        <g key={t} class="bound">
          <line class="tick" x1={x(t)} x2={x(t)} y1={AXIS_Y - 16} y2={AXIS_Y + 16} />
          <text x={x(t)} y={AXIS_Y + 40}>
            {asked === 'end' && t === end ? '?' : clockText(t)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const WEEK = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** A month of the calendar (#56): a line per week from Monday, the weekend tinted, a day circled. */
export function CalendarFigure({
  year,
  month,
  mark,
}: {
  year: number;
  month: number;
  mark?: number;
}) {
  const first = weekday(year, month, 1);
  const length = daysIn(year, month);
  const cells = [
    ...Array.from({ length: first }, () => 0),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(7 * i, 7 * i + 7),
  );
  return (
    <table class="calendar" aria-label={`${MONTHS[month]} ${year}`}>
      <caption>
        {MONTHS[month]} {year}
      </caption>
      <thead>
        <tr>
          {WEEK.map((day, i) => (
            <th key={day} class={i >= 5 ? 'weekend' : ''}>
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, w) => (
          <tr key={w}>
            {Array.from({ length: 7 }, (_, i) => week[i] ?? 0).map((day, i) => (
              <td
                key={i}
                class={[i >= 5 ? 'weekend' : '', day !== 0 && day === mark ? 'mark' : '']
                  .join(' ')
                  .trim()}
              >
                {day !== 0 && <span>{day}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
