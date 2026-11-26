/** A conversion table (#59): a column per unit, a digit in some, the columns to read outlined. */
export function ConversionTable({
  units,
  digits,
  marks,
}: {
  units: readonly string[];
  digits: readonly (number | null)[];
  marks: readonly number[];
}) {
  return (
    <table class="conversion" aria-label="Tableau de conversion">
      <thead>
        <tr>
          {units.map((unit, i) => (
            <th key={unit} class={marks.includes(i) ? 'mark' : ''}>
              {unit}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {units.map((unit, i) => (
            <td key={unit} class={marks.includes(i) ? 'mark' : ''}>
              {digits[i] ?? ''}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** How a coin or a note is written on it: « 2 € », « 50 c ». */
const faceValue = (cents: number) => (cents >= 100 ? `${cents / 100} €` : `${cents} c`);

/** Coins and notes laid out to be counted (#59), the notes first. */
export function Purse({ cents }: { cents: readonly number[] }) {
  return (
    <div class="purse" role="img" aria-label="Pièces et billets">
      {cents.map((value, i) => (
        <span key={i} class={`${value >= 500 ? 'note' : 'coin'} v${value}`}>
          {faceValue(value)}
        </span>
      ))}
    </div>
  );
}
