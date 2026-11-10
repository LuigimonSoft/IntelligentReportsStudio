/** Report syntax locations without including document contents in errors or logs. */
export class JsonSyntaxError extends Error {
  readonly line?: number;
  readonly column?: number;
  constructor(input: string, cause: unknown) {
    super('Invalid JSON file.');
    this.name = 'JsonSyntaxError';
    const message = cause instanceof Error ? cause.message : '';
    const coordinates = /\bline\s+(\d+)\s*(?:,\s*)?column\s+(\d+)/i.exec(message);
    if (coordinates) {
      const line = Number(coordinates[1]), column = Number(coordinates[2]);
      if (Number.isSafeInteger(line) && line > 0 && Number.isSafeInteger(column) && column > 0) {
        this.line = line;
        this.column = column;
        return;
      }
    }
    const position = /\bposition\s+(\d+)/i.exec(message);
    const offset = position ? Number(position[1]) : /unexpected end/i.test(message) ? input.length : -1;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > input.length) return;
    const lines = input.slice(0, offset).split(/\r\n|\r|\n/);
    this.line = lines.length;
    this.column = lines[lines.length - 1].length + 1;
  }
}

export function parseImportJson(input: string): unknown {
  try { return JSON.parse(input); }
  catch (cause) { throw new JsonSyntaxError(input, cause); }
}
