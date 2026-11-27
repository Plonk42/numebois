const NUMBERS = [
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
];

/** How the parts are called, one and several: « un tiers », « deux tiers ». */
const PARTS: Record<number, readonly [string, string]> = {
  2: ['demi', 'demis'],
  3: ['tiers', 'tiers'],
  4: ['quart', 'quarts'],
  5: ['cinquième', 'cinquièmes'],
  6: ['sixième', 'sixièmes'],
  7: ['septième', 'septièmes'],
  8: ['huitième', 'huitièmes'],
  9: ['neuvième', 'neuvièmes'],
  10: ['dixième', 'dixièmes'],
  11: ['onzième', 'onzièmes'],
  12: ['douzième', 'douzièmes'],
};

/** The largest denominator of the CE2 (BO n° 41 du 31/10/2024). */
export const MAX_DENOMINATOR = 12;

/** The name of the parts of a whole shared in `d`: « quarts », or « quart » for one. */
export function partsName(d: number, one = false): string {
  return PARTS[d][one ? 0 : 1];
}

/** A fraction read aloud as at school: 6/9 is « six neuvièmes ». */
export function fractionWords(n: number, d: number): string {
  return `${NUMBERS[n]} ${partsName(d, n === 1)}`;
}

/** A small number in words, for the hints: « deux fois plus ». */
export const numberWord = (n: number) => NUMBERS[n];
