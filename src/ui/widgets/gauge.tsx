/** Instruments to read (#58): the dial of a kitchen scale, a measuring jug. */

interface GaugeProps {
  max: number;
  step: number;
  label: number;
  value: number;
  unit: string;
}

const ticksOf = (max: number, step: number) =>
  Array.from({ length: max / step + 1 }, (_, i) => i * step);

const DIAL = { cx: 180, cy: 186, r: 150, from: -135, sweep: 270 };

/** A kitchen scale: the numbers around its dial, the needle on the weight. */
export function ScaleDial({ max, step, label, value, unit }: GaugeProps) {
  const angle = (v: number) => DIAL.from + (DIAL.sweep * v) / max;
  const at = (v: number, r: number): [number, number] => {
    const rad = (angle(v) * Math.PI) / 180;
    return [DIAL.cx + r * Math.sin(rad), DIAL.cy - r * Math.cos(rad)];
  };
  return (
    <svg class="gauge scale" viewBox="0 0 360 340" role="img" aria-label="Balance">
      <rect class="body" x={12} y={18} width={336} height={318} rx={60} />
      <circle class="face" cx={DIAL.cx} cy={DIAL.cy} r={DIAL.r + 8} />
      {ticksOf(max, step).map((v) => {
        const major = v % label === 0;
        const [x1, y1] = at(v, DIAL.r - (major ? 18 : 10));
        const [x2, y2] = at(v, DIAL.r);
        return <line key={v} class={major ? 'tick major' : 'tick'} {...{ x1, y1, x2, y2 }} />;
      })}
      {ticksOf(max, label).map((v) => {
        const [x, y] = at(v, DIAL.r - 40);
        return (
          <text key={v} x={x} y={y}>
            {v}
          </text>
        );
      })}
      <text class="unit" x={DIAL.cx} y={DIAL.cy + 70}>
        {unit}
      </text>
      <line
        class="needle"
        x1={DIAL.cx}
        y1={DIAL.cy + 16}
        x2={DIAL.cx}
        y2={DIAL.cy - DIAL.r + 6}
        transform={`rotate(${angle(value)} ${DIAL.cx} ${DIAL.cy})`}
      />
      <circle class="pivot" cx={DIAL.cx} cy={DIAL.cy} r={9} />
    </svg>
  );
}

const JUG = { left: 120, right: 250, top: 30, bottom: 320, zero: 306, full: 56 };

/** A measuring jug: the graduations on its side, the liquid up to the quantity. */
export function Jug({ max, step, label, value, unit }: GaugeProps) {
  const y = (v: number) => JUG.zero - ((JUG.zero - JUG.full) * v) / max;
  return (
    <svg class="gauge jug" viewBox="0 0 300 340" role="img" aria-label="Verre doseur">
      <path
        class="handle"
        d={`M${JUG.right} 90 C ${JUG.right + 52} 90, ${JUG.right + 52} 220, ${JUG.right} 220`}
      />
      <path
        class="liquid"
        d={`M${JUG.left} ${y(value)} H${JUG.right} V${JUG.bottom - 14} Q${JUG.right} ${JUG.bottom} ${JUG.right - 14} ${JUG.bottom} H${JUG.left + 14} Q${JUG.left} ${JUG.bottom} ${JUG.left} ${JUG.bottom - 14} Z`}
      />
      <line class="surface" x1={JUG.left} x2={JUG.right} y1={y(value)} y2={y(value)} />
      <path
        class="glass"
        d={`M${JUG.left} ${JUG.top} V${JUG.bottom - 14} Q${JUG.left} ${JUG.bottom} ${JUG.left + 14} ${JUG.bottom} H${JUG.right - 14} Q${JUG.right} ${JUG.bottom} ${JUG.right} ${JUG.bottom - 14} V${JUG.top}`}
      />
      {ticksOf(max, step).map((v) => {
        const major = v % label === 0;
        return (
          <line
            key={v}
            class={major ? 'tick major' : 'tick'}
            x1={JUG.left}
            x2={JUG.left + (major ? 34 : 20)}
            y1={y(v)}
            y2={y(v)}
          />
        );
      })}
      {ticksOf(max, label)
        .filter((v) => v > 0)
        .map((v) => (
          <text key={v} x={JUG.left - 10} y={y(v)}>
            {v} {unit}
          </text>
        ))}
    </svg>
  );
}
