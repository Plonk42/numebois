import type { ComponentChildren } from 'preact';

/** A fraction written as at school (#61), the numerator over the denominator. */
export function Frac({ n, d }: { n: ComponentChildren; d: ComponentChildren }) {
  return (
    <span class="frac">
      <span class="numerator">{n}</span>
      <span class="denominator">{d}</span>
    </span>
  );
}

const FRACTION = /(\d{1,2}|\?)\/(\d{1,2})/g;

/** Whether a text holds a fraction « 3/4 » (or « ?/8 »). */
export const hasFraction = (text: string) => /(\d{1,2}|\?)\/\d{1,2}/.test(text);

/** A text with its fractions written one over the other: « Colorie 3/4 de la galette. » */
export function withFractions(text: string): ComponentChildren {
  if (!hasFraction(text)) return text;
  const out: ComponentChildren[] = [];
  let last = 0;
  for (const match of text.matchAll(FRACTION)) {
    out.push(text.slice(last, match.index), <Frac key={match.index} n={match[1]} d={match[2]} />);
    last = match.index + match[0].length;
  }
  out.push(text.slice(last));
  return out;
}
