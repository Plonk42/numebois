/**
 * Limited arithmetic interpreter for content (word problems, quest parameters), never `eval`:
 * whole or decimal numbers, variables, + − × ÷ (or + - * /), parentheses, unary minus.
 * Anything else throws an `ExprError`.
 */
export class ExprError extends Error {}

const MAX_LENGTH = 200;
const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([-+*/×÷−()]))/y;

type Token = { kind: 'number'; value: number } | { kind: 'name' | 'symbol'; value: string };

function tokenize(source: string): Token[] {
  if (source.length > MAX_LENGTH) throw new ExprError('expression trop longue');
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (source.slice(TOKEN.lastIndex).trim() !== '') {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match) throw new ExprError(`caractère inattendu à la position ${at}`);
    if (match[1] !== undefined) tokens.push({ kind: 'number', value: Number(match[1]) });
    else if (match[2] !== undefined) tokens.push({ kind: 'name', value: match[2] });
    else tokens.push({ kind: 'symbol', value: match[3] });
  }
  return tokens;
}

const ADDITIVE = new Set(['+', '-', '−']);
const MULTIPLICATIVE = new Set(['*', '×', '/', '÷']);

export function evaluate(source: string, variables: Readonly<Record<string, number>> = {}): number {
  const tokens = tokenize(source);
  let index = 0;
  const peek = () => tokens[index];
  const isSymbol = (set: ReadonlySet<string>) => {
    const token = peek();
    return token?.kind === 'symbol' && set.has(token.value);
  };

  const factor = (): number => {
    const token = tokens[index++];
    if (!token) throw new ExprError('expression incomplète');
    if (token.kind === 'number') return token.value;
    if (token.kind === 'name') {
      if (!Object.hasOwn(variables, token.value)) {
        throw new ExprError(`variable inconnue : ${token.value}`);
      }
      const value = variables[token.value];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ExprError(`variable non numérique : ${token.value}`);
      }
      return value;
    }
    if (token.value === '-' || token.value === '−') return -factor();
    if (token.value === '(') {
      const value = sum();
      if (tokens[index++]?.value !== ')') throw new ExprError('parenthèse non fermée');
      return value;
    }
    throw new ExprError(`symbole inattendu : ${token.value}`);
  };

  const product = (): number => {
    let value = factor();
    while (isSymbol(MULTIPLICATIVE)) {
      const op = tokens[index++].value;
      const right = factor();
      if (op === '*' || op === '×') value *= right;
      else if (right === 0) throw new ExprError('division par zéro');
      else value /= right;
    }
    return value;
  };

  const sum = (): number => {
    let value = product();
    while (isSymbol(ADDITIVE)) {
      const op = tokens[index++].value;
      value = op === '+' ? value + product() : value - product();
    }
    return value;
  };

  const value = sum();
  if (index < tokens.length) throw new ExprError(`en trop : ${String(peek().value)}`);
  return value;
}
