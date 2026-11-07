import type { ExpressionContext, ReportDefinition, TextStyle } from './types.ts';

type Node =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'field'; name: string }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'unary'; op: string; value: Node }
  | { kind: 'call'; name: string; args: Node[] };
type Token = { kind: 'number' | 'string' | 'id' | 'symbol' | 'end'; value: string };

function tokenize(source: string): Token[] {
  if (source.length > 2048) throw new Error('The expression exceeds 2048 characters.');
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }
    const rest = source.slice(i);
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
    if (number) {
      tokens.push({ kind: 'number', value: number[0] });
      i += number[0].length;
      continue;
    }
    const id = /^[a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_][a-zA-Z_0-9]*)?/.exec(rest);
    if (id) {
      tokens.push({ kind: 'id', value: id[0] });
      i += id[0].length;
      continue;
    }
    if (source[i] === "'" || source[i] === '"') {
      const quote = source[i++];
      let value = '';
      let closed = false;
      while (i < source.length) {
        const char = source[i++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\') {
          if (i >= source.length) break;
          value += source[i++];
        } else value += char;
      }
      if (!closed) throw new Error('Unclosed string in the expression.');
      tokens.push({ kind: 'string', value });
      continue;
    }
    const operator = /^(===|!==|>=|<=|==|!=|<>|&&|\|\||[><!])/.exec(rest);
    if (operator) {
      tokens.push({ kind: 'symbol', value: operator[0] });
      i += operator[0].length;
      continue;
    }
    if ('+-*/(),='.includes(source[i])) {
      tokens.push({ kind: 'symbol', value: source[i++] });
      continue;
    }
    throw new Error(`Unsupported symbol: ${source[i]}`);
  }
  tokens.push({ kind: 'end', value: '' });
  return tokens;
}

function parse(source: string): Node {
  const tokens = tokenize(source);
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position];
  function expect(value: string) {
    if (peek().value !== value) throw new Error(`Se esperaba «${value}» en ${source}.`);
    position++;
  }
  function primary(): Node {
    if (++depth > 40) throw new Error('Expression nesting is too deep.');
    try {
      const token = tokens[position++];
      if (token.kind === 'number') return { kind: 'literal', value: Number(token.value) };
      if (token.kind === 'string') return { kind: 'literal', value: token.value };
      if (token.kind === 'id' && ['TRUE', 'FALSE', 'NULL'].includes(token.value.toUpperCase()))
        return {
          kind: 'literal',
          value:
            token.value.toUpperCase() === 'TRUE'
              ? true
              : token.value.toUpperCase() === 'FALSE'
                ? false
                : null,
        };
      if (token.value === '!' || token.value.toUpperCase() === 'NOT')
        return { kind: 'unary', op: '!', value: primary() };
      if (token.value === '-' || token.value === '+')
        return { kind: 'unary', op: token.value, value: primary() };
      if (token.value === '(') {
        const node = expression();
        expect(')');
        return node;
      }
      if (token.kind === 'id') {
        if (peek().value !== '(') return { kind: 'field', name: token.value };
        position++;
        const args: Node[] = [];
        if (peek().value !== ')') {
          do {
            args.push(expression());
            if (peek().value !== ',') break;
            position++;
          } while (true);
        }
        expect(')');
        return { kind: 'call', name: token.value.toUpperCase(), args };
      }
      throw new Error(`Invalid expression: ${source}`);
    } finally {
      depth--;
    }
  }
  function multiply(): Node {
    let left = primary();
    while (peek().value === '*' || peek().value === '/') {
      const op = tokens[position++].value;
      left = { kind: 'binary', op, left, right: primary() };
    }
    return left;
  }
  function addition(): Node {
    let left = multiply();
    while (peek().value === '+' || peek().value === '-') {
      const op = tokens[position++].value;
      left = { kind: 'binary', op, left, right: multiply() };
    }
    return left;
  }
  function comparison(): Node {
    let left = addition();
    while (['>', '<', '>=', '<=', '==', '===', '!=', '!==', '<>', '='].includes(peek().value)) {
      const op = tokens[position++].value;
      left = { kind: 'binary', op, left, right: addition() };
    }
    return left;
  }
  function conjunction(): Node {
    let left = comparison();
    while (['&&', 'AND'].includes(peek().value.toUpperCase())) {
      position++;
      left = { kind: 'binary', op: '&&', left, right: comparison() };
    }
    return left;
  }
  function expression(): Node {
    let left = conjunction();
    while (['||', 'OR'].includes(peek().value.toUpperCase())) {
      position++;
      left = { kind: 'binary', op: '||', left, right: conjunction() };
    }
    return left;
  }
  const result = expression();
  if (peek().kind !== 'end') throw new Error(`Content is not allowed in ${source}.`);
  return result;
}
function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('The condition must return a boolean value.');
  return value;
}
function numeric(value: unknown): number {
  if (value === '' || value === null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric value: ${String(value)}`);
  return n;
}
function evaluate(node: Node, context: ExpressionContext): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'field': {
      if (node.name === 'ROW_NUMBER') return context.rowNumber ?? 1;
      if (node.name === 'ROW_COUNT') return context.rowCount ?? context.rows.length;
      if (node.name === 'TABLE_ROW_NUMBER') return context.tableRowNumber ?? 1;
      if (node.name === 'COLUMN_NUMBER') return context.columnNumber ?? 1;
      if (node.name === 'IS_ODD_ROW') return (context.rowNumber ?? 1) % 2 === 1;
      if (node.name === 'PAGE_NUMBER') return context.pageNumber ?? 1;
      if (node.name === 'PAGE_COUNT') return context.pageCount ?? 1;
      const formula = context.formulas?.find((formula) => formula.name === node.name);
      if (formula) {
        const stack = context.formulaStack ?? [];
        if (stack.includes(formula.name) || stack.length >= 50)
          throw new Error('Circular formula reference.');
        return evaluateExpression(formula.expression, {
          ...context,
          formulaStack: [...stack, formula.name],
        });
      }
      if (node.name.includes('.')) {
        const [source, field] = node.name.split('.');
        if (
          ['__proto__', 'constructor', 'prototype'].includes(source) ||
          ['__proto__', 'constructor', 'prototype'].includes(field)
        )
          return '';
        const row =
          context.sources && Object.hasOwn(context.sources, source)
            ? context.sources[source]
            : undefined;
        return row && Object.hasOwn(row, field) ? row[field] : '';
      }
      return Object.hasOwn(context.row, node.name) ? context.row[node.name] : '';
    }
    case 'unary':
      if (node.op === '!') return !booleanValue(evaluate(node.value, context));
      return (node.op === '-' ? -1 : 1) * numeric(evaluate(node.value, context));
    case 'binary': {
      if (node.op === '&&')
        return (
          booleanValue(evaluate(node.left, context)) && booleanValue(evaluate(node.right, context))
        );
      if (node.op === '||')
        return (
          booleanValue(evaluate(node.left, context)) || booleanValue(evaluate(node.right, context))
        );
      const left = evaluate(node.left, context),
        right = evaluate(node.right, context);
      if (['==', '===', '='].includes(node.op)) return left === right;
      if (['!=', '!==', '<>'].includes(node.op)) return left !== right;
      if (['>', '<', '>=', '<='].includes(node.op)) {
        if (typeof left !== typeof right || !['number', 'string'].includes(typeof left))
          throw new Error('Compare values of the same type.');
        const a = left as number,
          b = right as number;
        return node.op === '>'
          ? a > b
          : node.op === '<'
            ? a < b
            : node.op === '>='
              ? a >= b
              : a <= b;
      }
      const a = numeric(left);
      const b = numeric(right);
      if (node.op === '/' && b === 0) throw new Error('Division by zero.');
      const result =
        node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : a / b;
      if (!Number.isFinite(result)) throw new Error('The numeric result is not finite.');
      return Math.round(result * 1e10) / 1e10;
    }
    case 'call': {
      const arity = (count: number) => {
        if (node.args.length !== count)
          throw new Error(`${node.name} requires ${count} arguments.`);
      };
      if (node.name === 'MOD') {
        arity(2);
        const divisor = numeric(evaluate(node.args[1], context));
        if (divisor === 0) throw new Error('Division by zero.');
        return numeric(evaluate(node.args[0], context)) % divisor;
      }
      if (node.name === 'FIELD') {
        arity(2);
        const dataset = String(evaluate(node.args[0], context)),
          field = String(evaluate(node.args[1], context));
        const row =
          context.sources && Object.hasOwn(context.sources, dataset)
            ? context.sources[dataset]
            : undefined;
        return row &&
          Object.hasOwn(row, field) &&
          !['__proto__', 'prototype', 'constructor'].includes(field)
          ? row[field]
          : '';
      }
      if (['IF', 'IIF'].includes(node.name)) {
        arity(3);
        return evaluate(node.args[booleanValue(evaluate(node.args[0], context)) ? 1 : 2], context);
      }
      if (node.name === 'NOT') {
        arity(1);
        return !booleanValue(evaluate(node.args[0], context));
      }
      if (['AND', 'OR'].includes(node.name)) {
        if (!node.args.length) throw new Error('The function requires arguments.');
        return node.name === 'AND'
          ? node.args.every((arg) => booleanValue(evaluate(arg, context)))
          : node.args.some((arg) => booleanValue(evaluate(arg, context)));
      }
      if (node.name === 'DATE') {
        arity(0);
        return context.now;
      }
      if (node.name === 'SUM') {
        arity(1);
        if (context.rows.length > 10000) throw new Error('Maximum 10000 rows per source.');
        const result = context.rows.reduce(
          (sum, row) =>
            sum +
            numeric(
              evaluate(node.args[0], {
                ...context,
                row,
                rows: [],
                sources: context.dataset
                  ? { ...context.sources, [context.dataset]: row }
                  : context.sources,
              }),
            ),
          0,
        );
        return Math.round(result * 1e10) / 1e10;
      }
      if (node.name === 'FORMAT') {
        arity(2);
        const value = evaluate(node.args[0], context);
        const pattern = String(evaluate(node.args[1], context));
        if (value instanceof Date) {
          const day = value.getDate();
          const month = value.getMonth() + 1;
          return pattern.replace(
            /yyyy|yy|mm|dd|m|d/g,
            (part) =>
              ({
                yyyy: String(value.getFullYear()),
                yy: String(value.getFullYear()).slice(-2),
                mm: String(month).padStart(2, '0'),
                dd: String(day).padStart(2, '0'),
                m: String(month),
                d: String(day),
              })[part]!,
          );
        }
        if (pattern === '0.00') return numeric(value).toFixed(2);
        if (pattern === '0') return numeric(value).toFixed(0);
        throw new Error(`Unsupported format: ${pattern}`);
      }
      throw new Error(`Unsupported function: ${node.name}`);
    }
  }
}
const cache = new Map<string, Node>();
export function validateExpression(source: string): void {
  const allowed = new Set([
    'IF',
    'IIF',
    'SUM',
    'MOD',
    'AND',
    'OR',
    'NOT',
    'DATE',
    'FORMAT',
    'FIELD',
  ]);
  function check(node: Node): void {
    if (node.kind === 'call') {
      if (!allowed.has(node.name)) throw new Error(`Unsupported function: ${node.name}`);
      const counts: Record<string, number> = {
        IF: 3,
        IIF: 3,
        SUM: 1,
        MOD: 2,
        NOT: 1,
        DATE: 0,
        FORMAT: 2,
        FIELD: 2,
      };
      if (node.name in counts && node.args.length !== counts[node.name])
        throw new Error(`${node.name} requires ${counts[node.name]} arguments.`);
      if (['AND', 'OR'].includes(node.name) && !node.args.length)
        throw new Error('The function requires arguments.');
      node.args.forEach(check);
    } else if (node.kind === 'binary') {
      check(node.left);
      check(node.right);
    } else if (node.kind === 'unary') check(node.value);
  }
  check(parse(source.trim().replace(/^=/, '')));
}
export function evaluateExpression(source: string, context: ExpressionContext): unknown {
  source = source.trim().replace(/^=/, '');
  let node = cache.get(source);
  if (!node) {
    node = parse(source);
    if (cache.size >= 500) cache.clear();
    cache.set(source, node);
  }
  return evaluate(node, context);
}
export function renderText(
  template: string,
  context: ExpressionContext,
  report: Pick<ReportDefinition, 'locale' | 'currency'>,
  style: Pick<TextStyle, 'format'>,
): string {
  return template.replace(/\\n/g, '\n').replace(/\[([^\[\]]+)\]/g, (_match, expression: string) => {
    const value = evaluateExpression(expression, context);
    if (typeof value === 'number') {
      if (style.format === 'currency')
        return new Intl.NumberFormat(report.locale, {
          style: 'currency',
          currency: report.currency,
        }).format(value);
      if (style.format === 'number')
        return new Intl.NumberFormat(report.locale, { maximumFractionDigits: 2 }).format(value);
    }
    return value instanceof Date ? value.toLocaleDateString(report.locale) : String(value ?? '');
  });
}
