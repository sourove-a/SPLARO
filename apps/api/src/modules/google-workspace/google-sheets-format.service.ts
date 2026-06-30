import type { sheets_v4 } from 'googleapis'

const HEADER_BG = { red: 0.067, green: 0.067, blue: 0.067 }
const HEADER_FG = { red: 0.784, green: 0.663, blue: 0.494 }
const ALT_ROW_BG = { red: 0.976, green: 0.973, blue: 0.969 }

export function buildSheetFormatRequests(
  sheetId: number,
  columnCount: number,
  dataRowCount: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { foregroundColor: HEADER_FG, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(dataRowCount, 1),
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
        },
      },
    },
  ]

  if (dataRowCount > 1) {
    for (let row = 1; row < dataRowCount; row += 2) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: row,
            endRowIndex: row + 1,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          cell: {
            userEnteredFormat: { backgroundColor: ALT_ROW_BG },
          },
          fields: 'userEnteredFormat.backgroundColor',
        },
      })
    }
  }

  return requests
}
