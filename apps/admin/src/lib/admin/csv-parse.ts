/** Minimal RFC4180-ish CSV parser — no dependency. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\r') {
      // skip
    } else {
      cell += ch
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.length > 0))
}

export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headerRow = rows[0]
  if (!headerRow) return []
  const headers = headerRow.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim()
    })
    return obj
  })
}
