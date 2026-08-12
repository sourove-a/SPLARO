import * as XLSX from 'xlsx'

import { downloadBlob, downloadCsv } from '@/lib/admin/admin-actions'
import { csvRowsToObjects, parseCsvText } from '@/lib/admin/csv-parse'

/** Normalize spreadsheet headers the same way CSV does. */
export function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

export function matrixToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headerRow = rows[0]
  if (!headerRow) return []
  const headers = headerRow.map(normalizeHeader)
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (!h) return
      obj[h] = String(cells[i] ?? '').trim()
    })
    return obj
  })
}

function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  return raw
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
}

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024

export function assertSpreadsheetFileSize(file: File) {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum is ${MAX_SPREADSHEET_BYTES / 1024 / 1024} MB.`,
    )
  }
}

/**
 * Parse a CSV or .xlsx file into row objects keyed by normalized headers.
 * Excel uses the first worksheet only.
 */
export async function parseSpreadsheetFile(file: File): Promise<{
  objects: Record<string, string>[]
  matrix: string[][]
  kind: 'csv' | 'xlsx'
}> {
  assertSpreadsheetFileSize(file)
  const name = file.name.toLowerCase()
  const isXlsx =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')

  if (isXlsx) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const first = workbook.SheetNames[0]
    if (!first) throw new Error('The workbook has no sheets.')
    const sheet = workbook.Sheets[first]
    if (!sheet) throw new Error('Could not read the first sheet.')
    const matrix = sheetToMatrix(sheet)
    return { objects: matrixToObjects(matrix), matrix, kind: 'xlsx' }
  }

  const text = await file.text()
  const matrix = parseCsvText(text)
  return { objects: csvRowsToObjects(matrix), matrix, kind: 'csv' }
}

export function downloadXlsx(filename: string, rows: string[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Products')
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const base = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/i, '')}.xlsx`
  downloadBlob(
    base,
    data,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

export function downloadSheet(filenameBase: string, rows: string[][], format: 'csv' | 'xlsx') {
  if (format === 'xlsx') {
    downloadXlsx(filenameBase, rows)
    return
  }
  downloadCsv(filenameBase.endsWith('.csv') ? filenameBase : `${filenameBase}.csv`, rows)
}
