const ITEM_GAP = 36;
const ROW = 5;
const BASKET_W = 64;
const BASKET_GAP = 14;
const BASKET_H = 44;

/**
 * Things to share out (#175), drawn as tokens in rows of 5, and under them the empty groups
 * to fill. Neutral tokens: the statement says what they are.
 */
export function ShareFigure({ items, groups }: { items: number; groups: number }) {
  const rows = Math.ceil(items / ROW);
  const columns = Math.min(items, ROW);
  const itemsWidth = columns * ITEM_GAP;
  const basketsWidth = groups * BASKET_W + (groups - 1) * BASKET_GAP;
  const width = Math.max(itemsWidth, basketsWidth);
  const top = rows * ITEM_GAP;
  const height = top + (groups > 0 ? BASKET_H + 20 : 0);
  const x0 = (width - itemsWidth) / 2;
  const b0 = (width - basketsWidth) / 2;
  return (
    <svg
      class="share"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: `${width}px` }}
      aria-label={groups > 0 ? `${items} à partager en ${groups}` : `${items} à ranger`}
    >
      {Array.from({ length: items }, (_, i) => {
        const column = i % ROW;
        const cx = x0 + (column + 0.5) * ITEM_GAP;
        const cy = (Math.floor(i / ROW) + 0.5) * ITEM_GAP;
        return <circle key={i} class="item" cx={cx} cy={cy} r={ITEM_GAP * 0.34} />;
      })}
      {Array.from({ length: groups }, (_, i) => {
        const x = b0 + i * (BASKET_W + BASKET_GAP);
        const y = top + 16;
        return (
          <path
            key={`g${i}`}
            class="group"
            d={`M${x} ${y} L${x + BASKET_W} ${y} L${x + BASKET_W - 8} ${y + BASKET_H} L${x + 8} ${y + BASKET_H} Z`}
          />
        );
      })}
    </svg>
  );
}
