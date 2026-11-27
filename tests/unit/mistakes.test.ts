import { describe, expect, it } from 'vitest';
import { bubbleErrors } from '../../src/core/content';
import { skillsById } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { timeText, parseTime } from '../../src/core/time';
import type { Exercise } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import { additionHint, multiplicationHint } from '../../src/domains/column-arithmetic/hints';
import {
  generateAddition,
  generateMultiplication,
} from '../../src/domains/column-arithmetic/generators';
import { drawHint } from '../../src/domains/measures/hints';
import { generateDraw } from '../../src/domains/measures/generators';
import { generateCompare, generateOrder } from '../../src/domains/numbers/generators';
import { compareHint, orderHint } from '../../src/domains/numbers/hints';
import { compareLengthsHint, generateCompareLengths } from '../../src/domains/units/compare';
import {
  amountText,
  countMoney,
  generateMagnitude,
  generateMoney,
} from '../../src/domains/units/everyday';
import { generateRelation, UNIT_RELATIONS } from '../../src/domains/units/generators';
import { magnitudeHint, moneyHint, relationHint } from '../../src/domains/units/hints';
import { problemHint } from '../../src/domains/word-problems/hints';
import type { ProblemExercise } from '../../src/domains/word-problems/problems';
import { CLEARING } from './helpers';

const tried = (answer: string | number) => ({ answer: String(answer) });

// The notions without lures: each mistake Plume names (#168), the method otherwise.
describe('indices après une erreur, notions sans leurres (#168)', () => {
  it('compare and order numbers: the sign reversed, « = », the other end, fewer digits', () => {
    const compare = { ...generateCompare(new Rng(1), 0), a: 342, b: 512, answer: '<' };
    expect(compareHint(compare, 1, tried('>'))).toBe(
      'Le signe est à l’envers.\nLa pointe montre le plus petit nombre.',
    );
    expect(compareHint(compare, 1, tried('='))).toBe(
      'Les nombres ne sont pas pareils.\nCompare rang par rang, en partant de la gauche.',
    );
    const order = {
      ...generateOrder(new Rng(1), 2),
      values: [987, 1203, 1032, 1320],
      want: 'largest' as const,
      answer: '1\u202f320',
    };
    expect(orderHint(order, 1, tried('987'))).toBe(
      'Ça, c’est le plus petit.\nOn cherche le plus grand.',
    );
    const smallest = { ...order, want: 'smallest' as const, answer: '987' };
    expect(orderHint(smallest, 1, tried('1\u202f320'))).toBe(
      'Ça, c’est le plus grand.\nOn cherche le plus petit.',
    );
    const digits = { ...order, values: [987, 1203, 1032, 120] };
    expect(orderHint({ ...digits, answer: '1\u202f203' }, 1, tried('987'))).toBe(
      '987 n’a que 3 chiffres.\nLe nombre qui a le plus de chiffres est le plus grand.',
    );
  });

  it('compare lengths: the numbers alone, the sign reversed, the same digits', () => {
    const base = generateCompareLengths(new Rng(1), 0);
    const signs = {
      ...base,
      sides: [[[59, 'cm']], [[7, 'dm']]] as const,
      answer: '<',
    };
    expect(compareLengthsHint(signs, 1, tried('>'))).toBe(
      'Tu as comparé les nombres, pas les longueurs.\nÉcris les deux mesures en cm.',
    );
    const reversed = { ...signs, sides: [[[59, 'cm']], [[70, 'cm']]] as const };
    expect(compareLengthsHint(reversed, 1, tried('>'))).toBe(
      'Le signe est à l’envers.\nLa pointe montre la plus petite longueur.',
    );
    const equal = {
      ...generateCompareLengths(new Rng(1), 2),
      sides: [[[59, 'cm']], [[590, 'mm']]] as const,
      answer: '590\u00a0mm',
    };
    expect(compareLengthsHint(equal, 1, tried('59\u00a0dm'))).toBe(
      'Mêmes chiffres, autre unité : ce n’est pas égal.\nPlace 59\u00a0cm dans le tableau.',
    );
  });

  it('a relation: a 0 too many or too few', () => {
    const relation = UNIT_RELATIONS.find((r) => r.big === 'm' && r.small === 'cm')!;
    const e = { ...generateRelation(new Rng(1), 0), relation, back: false, answer: '100' };
    expect(relationHint(e, 1, tried(1000))).toBe(
      'Un 0 de trop.\nDu m au cm : un 0 par colonne du tableau.',
    );
    expect(relationHint(e, 1, tried(10))).toBe(
      'Il manque un 0.\nDu m au cm : un 0 par colonne du tableau.',
    );
    expect(relationHint({ ...e, back: true, answer: '1' }, 1, tried(10))).toContain(
      'Un 0 de trop.',
    );
  });

  it('money: the pieces counted one by one, 1 € off, the price', () => {
    const count = countMoney([500, 200, 100], 0);
    expect(moneyHint(count, 1, tried(3))).toBe(
      'Tu as compté les billets et les pièces un par un.\nRegarde ce que vaut chacun.',
    );
    expect(moneyHint(count, 1, tried(7))).toBe(
      'Tu es à 1 € près.\nCompte d’abord les billets, puis les pièces.',
    );
    const change = { ...generateMoney(new Rng(1), 2), cents: 350 };
    expect(moneyHint(change, 1, tried(amountText(650)))).toBe(
      'Ça, c’est le prix.\nCompte ce qu’il faut ajouter pour aller jusqu’à 10 €.',
    );
  });

  it('orders of magnitude: far too much, far too little', () => {
    const pencil = {
      ...generateMagnitude(new Rng(1), 0),
      thing: { text: 'Un crayon mesure environ', n: 15, unit: 'cm' },
    };
    expect(magnitudeHint(pencil, 1, tried('15\u00a0m'))).toBe(
      '15\u00a0m, ce serait beaucoup trop.\n1 cm, c’est la largeur d’un doigt.\n1 m, c’est un grand pas.',
    );
    expect(magnitudeHint(pencil, 1, tried('15\u00a0mm'))).toContain('ce serait beaucoup trop peu.');
  });

  it('drawing: millimetres for centimetres, a millimetre or two off', () => {
    const e = { ...generateDraw(new Rng(1), 0), length: 60, answer: '60' };
    expect(drawHint(e, 1, tried(6))).toBe(
      'Ton trait fait 6 mm, pas 6 cm.\nArrête-toi sur le 6 de la règle.',
    );
    expect(drawHint(e, 1, tried(58))).toBe('Tu es à 2 mm près.\nArrête-toi pile sur le bon trait.');
    expect(drawHint(e, 1, tried(50))).toBe(drawHint(e, 1));
  });

  it('column operations: a carry forgotten, a column, the last digit', () => {
    const add = { ...generateAddition(new Rng(1), 4), rows: [358, 467] };
    // 358 + 467 = 825: the carry of the units forgotten in the tens.
    expect(additionHint(add, 1, tried(815))).toBe(
      'Aux dizaines, tu as oublié la retenue.\nElle est en haut de la colonne.',
    );
    expect(additionHint(add, 1, tried(835))).toBe(
      'Les unités sont bonnes.\nRecalcule la colonne des dizaines.',
    );
    const mul = { ...generateMultiplication(new Rng(1), 4), a: 68, b: 4 };
    expect(multiplicationHint(mul, 1, tried(72))).toBe(
      'Il manque le dernier chiffre.\nÀ la fin, écris le nombre entier.',
    );
    // 4 × 68 = 272: 4 × 6 = 24 without the 3 of the bag.
    expect(multiplicationHint(mul, 1, tried(242))).toBe(
      'Aux dizaines, tu as oublié la retenue.\nElle est dans le sac.',
    );
  });

  it('word problems: the other operation, the first step alone, the end reversed, a little off', () => {
    const skill = skillsById(DOMAINS).get('word-problems.add-subtract')!;
    const base = skill.generate(new Rng(1), 0, CLEARING) as ProblemExercise;
    const take = {
      ...base,
      steps: [[25, '−', 13]] as const,
      method: 'Il lui en reste moins : tu enlèves.',
      answer: '12',
    };
    expect(problemHint(take, 1, tried(38))).toBe(
      'Ça, c’est 25 + 13.\nIl lui en reste moins : tu enlèves.',
    );
    expect(problemHint(take, 1, tried(13))).toBe(
      'Tu as choisi le bon calcul.\nRefais 25 − 13 : tu es à 1 près.',
    );
    const two = {
      ...base,
      steps: [
        [25, '+', 13],
        [38, '−', 12],
      ] as const,
      answer: '26',
    };
    expect(problemHint(two, 1, tried(38))).toBe(
      'Tu as fait la 1re étape : 38.\nIl reste à enlever 12.',
    );
    expect(problemHint(two, 1, tried(50))).toBe(
      'La 1re étape est bonne.\nRelis la fin : on ajoute ou on enlève ?',
    );
    const times = {
      ...base,
      steps: [[4, '×', 8]] as const,
      method: '4 paniers de 8 : c’est 4 fois 8.',
      answer: '32',
    };
    expect(problemHint(times, 1, tried(12))).toBe(
      'Ça, c’est 4 + 8.\n4 paniers de 8 : c’est 4 fois 8.',
    );
  });
});

/** Wrong answers around the right one, of the widget's kind. */
function mistakesOf(exercise: Exercise): string[] {
  const { input, answer } = exercise;
  if (input.kind === 'choice') return input.options.filter((o) => o !== answer);
  if (input.kind === 'compare') return ['<', '=', '>'].filter((s) => s !== answer);
  const fraction = /^(\d+)\/(\d+)$/.exec(answer);
  if (fraction) {
    const [n, d] = [Number(fraction[1]), Number(fraction[2])];
    return [
      [d, n],
      [n, d - n],
      [d - n, d],
      [n + 1, d],
      [n, d + 1],
      [n - 1, d],
      [n, d * 2],
      [n * 2, d],
    ]
      .filter(([a, b]) => a >= 0 && b > 0 && (a !== n || b !== d))
      .map(([a, b]) => `${a}/${b}`);
  }
  const time = parseTime(answer);
  if (time) {
    const { hours, minutes } = time;
    return [
      timeText({ hours: minutes / 5 || 12, minutes: (5 * hours) % 60 }),
      timeText({ hours: hours + 1, minutes }),
      timeText({ hours: (hours + 11) % 24 || 12, minutes }),
      timeText({ hours, minutes: (minutes + 5) % 60 }),
      timeText({ hours: hours + 12, minutes }),
    ];
  }
  const n = Number(answer);
  if (!Number.isInteger(n)) return [];
  return [
    n + 1,
    n - 1,
    n + 2,
    n + 5,
    n - 5,
    n + 10,
    n - 10,
    n + 60,
    n - 60,
    n * 10,
    Math.floor(n / 10),
    n + 100,
  ]
    .filter((m) => m >= 0 && m !== n)
    .map(String);
}

describe('chaque indice après une erreur reste une bulle courte et douce (#168)', () => {
  for (const [id, skill] of skillsById(DOMAINS)) {
    it(id, () => {
      for (let level = 0; level < skill.levels; level++) {
        for (let seed = 0; seed < 200; seed++) {
          const exercise = skill.generate(new Rng(seed), level, CLEARING);
          for (const answer of mistakesOf(exercise)) {
            const errors = bubbleErrors(
              `indice après ${answer}`,
              skill.hint(exercise, 1, { answer }),
            );
            if (errors.length > 0)
              expect(errors, `${exercise.statement}, graine ${seed}`).toEqual([]);
          }
        }
      }
    });
  }
});
