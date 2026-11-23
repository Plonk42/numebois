// French number words in the 1990 spelling taught at school: hyphens everywhere.
const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0 to 99. */
function belowHundred(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const ten = Math.floor(n / 10);
  if (ten === 7 || ten === 9) {
    // soixante-dix, soixante-et-onze, quatre-vingt-dix, quatre-vingt-onze…
    const base = ten === 7 ? 'soixante' : 'quatre-vingt';
    const rest = n - (ten - 1) * 10;
    return `${base}${rest === 11 && ten === 7 ? '-et' : ''}-${belowHundred(rest)}`;
  }
  const unit = n % 10;
  if (ten === 8) return unit === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITS[unit]}`;
  if (unit === 0) return TENS[ten];
  return `${TENS[ten]}${unit === 1 ? '-et' : ''}-${UNITS[unit]}`;
}

/**
 * Words of a number from 1 to 10 000, cut by rank: thousands, hundreds, then the rest
 * (« trois-mille », « deux-cent », « quarante »). Joined by hyphens, they spell it.
 */
export function numberWordParts(n: number): string[] {
  if (!Number.isInteger(n) || n < 1 || n > 10_000) throw new RangeError(`${n}`);
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : `${belowHundred(thousands)}-mille`);
  if (hundreds > 0) {
    const cent = rest === 0 && hundreds > 1 ? 'cents' : 'cent';
    parts.push(hundreds === 1 ? cent : `${UNITS[hundreds]}-${cent}`);
  }
  if (rest > 0) parts.push(belowHundred(rest));
  return parts;
}

export function numberWords(n: number): string {
  return numberWordParts(n).join('-');
}

/** Digits grouped as written at school, up to 999 999: 3 240, 10 000. */
export function formatNumber(n: number): string {
  const digits = String(n);
  return digits.length > 3 ? `${digits.slice(0, -3)}\u202f${digits.slice(-3)}` : digits;
}
