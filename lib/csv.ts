export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length && (!headers || headers.length === 0)) return '';
  const cols = headers && headers.length > 0 ? headers : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (value: unknown) => {
    const raw = value == null ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const lines: string[] = [];
  lines.push(cols.map(escape).join(','));
  for (const row of rows) {
    lines.push(cols.map((key) => escape((row as any)[key])).join(','));
  }
  return lines.join('\n');
}

export function parseCsvText(input: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (ch === '\n') {
      row.push(cell.trim());
      out.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    out.push(row);
  }

  return out.filter((r) => r.some((c) => c !== ''));
}
