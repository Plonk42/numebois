import { MONTHS, clockText, daysIn, durationText, weekday } from '../../core/time';

const WIDTH = 430;
const HEIGHT = 196;
const PAD = 48;
const AXIS_Y = 118;

/**
 * The timeline (frise) of a duration (#56): the start and the end under the line, a jump over
 * it to each whole hour between them, without its length: the child counts each jump. When the
 * end is asked, a single jump with its duration, and a « ? » at its end.
 */
export function TimelineFigure({
  start,
  end,
  asked,
}: {
  start: number;
  end: number;
  asked: 'duration' | 'end';
}) {
  const x = (t: number) => PAD + ((t - start) / (end - start)) * (WIDTH - 2 * PAD);
  const hours: number[] = [];
  if (asked === 'duration') {
    for (let t = Math.ceil(start / 60) * 60; t < end; t += 60) if (t > start) hours.push(t);
  }
  const marks = [start, ...hours, end];
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
      {hours.map((t) => (
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
