function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SPLARO Tools')
    .addItem('Apply Premium Formatting', 'applyPremiumFormatting')
    .addToUi();
}

function applyPremiumFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().filter((s) => s.getName() !== 'Summary' && s.getLastRow() >= 1 && s.getLastColumn() >= 1);

  let grandTotalRows = 0;
  let grandTotalSales = 0;
  const statusCount = { PAID: 0, PENDING: 0, FAILED: 0 };
  const report = [];

  sheets.forEach((sheet) => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return;

    const fullRange = sheet.getRange(1, 1, lastRow, lastCol);
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    const bodyRows = Math.max(lastRow - 1, 0);
    const bodyRange = bodyRows > 0 ? sheet.getRange(2, 1, bodyRows, lastCol) : null;

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h || '').trim());
    const normHeaders = headers.map((h) => h.toLowerCase());

    sheet.setFrozenRows(1);

    fullRange.setFontFamily('Arial').setFontSize(10).setFontColor('#111827');
    sheet.setRowHeight(1, 34);
    if (bodyRows > 0) sheet.setRowHeights(2, bodyRows, 24);

    sheet.getBandings().forEach((b) => b.remove());
    const banding = fullRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setFirstRowColor('#FFFFFF');
    banding.setSecondRowColor('#F7F8FA');
    banding.setHeaderRowColor('#111827');

    headerRange
      .setBackground('#111827')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    const existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    if (lastRow >= 2) fullRange.createFilter();

    sheet.autoResizeColumns(1, lastCol);
    for (let c = 1; c <= lastCol; c++) {
      const h = normHeaders[c - 1];
      if (hasAny(h, ['id', 'order_no', 'invoice', 'qty', 'quantity', 'no'])) {
        sheet.setColumnWidth(c, 120);
      } else if (hasAny(h, ['phone', 'mobile', 'contact'])) {
        sheet.setColumnWidth(c, 145);
      } else if (hasAny(h, ['email'])) {
        sheet.setColumnWidth(c, 230);
      } else if (hasAny(h, ['address', 'note', 'comment', 'description', 'product_url', 'image_url'])) {
        sheet.setColumnWidth(c, 280);
      }
    }

    if (bodyRange) {
      for (let c = 1; c <= lastCol; c++) {
        const h = normHeaders[c - 1];
        const colRange = sheet.getRange(2, c, bodyRows, 1);
        if (hasAny(h, ['address', 'note', 'comment', 'description'])) {
          colRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
        } else {
          colRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
        }
      }
    }

    fullRange.setBorder(true, true, true, true, true, true, '#D9DEE7', SpreadsheetApp.BorderStyle.SOLID);
    fullRange.setBorder(true, true, true, true, null, null, '#C4CCD8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    const moneyCols = findColumns(normHeaders, ['price', 'total', 'amount', 'subtotal', 'shipping', 'discount', 'sales']);
    const dateCols = findColumns(normHeaders, ['date', 'created', 'updated', 'time', '_at']);
    const phoneCols = findColumns(normHeaders, ['phone', 'mobile', 'contact']);
    const idCols = findColumns(normHeaders, ['order_id', 'invoice', 'id', 'order_no']);

    if (bodyRows > 0) {
      moneyCols.forEach((c) => sheet.getRange(2, c, bodyRows, 1).setNumberFormat('"BDT" #,##0.00'));
      dateCols.forEach((c) => {
        const h = normHeaders[c - 1];
        const fmt = hasAny(h, ['time', '_at', 'created', 'updated']) ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd';
        sheet.getRange(2, c, bodyRows, 1).setNumberFormat(fmt);
      });
      phoneCols.forEach((c) => sheet.getRange(2, c, bodyRows, 1).setNumberFormat('@'));
      idCols.forEach((c) => sheet.getRange(2, c, bodyRows, 1).setNumberFormat('@'));
    }

    const rules = [];
    const statusCol = findFirstColumn(normHeaders, ['status']);
    const stockCol = findFirstColumn(normHeaders, ['stock']);
    const overdueCol = findFirstColumn(normHeaders, ['overdue']);

    if (bodyRows > 0 && statusCol > 0) {
      const statusLetter = colToLetter(statusCol);
      const statusRange = sheet.getRange(2, statusCol, bodyRows, 1);

      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=OR(UPPER($' + statusLetter + '2)="PAID",UPPER($' + statusLetter + '2)="SUCCESS")')
          .setBackground('#EAF7EF')
          .setRanges([statusRange])
          .build()
      );
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=UPPER($' + statusLetter + '2)="PENDING"')
          .setBackground('#FFF6E5')
          .setRanges([statusRange])
          .build()
      );
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=OR(UPPER($' + statusLetter + '2)="FAILED",UPPER($' + statusLetter + '2)="CANCELLED")')
          .setBackground('#FDECEC')
          .setRanges([statusRange])
          .build()
      );
    }

    if (bodyRows > 0 && stockCol > 0) {
      const stockLetter = colToLetter(stockCol);
      const stockRange = sheet.getRange(2, stockCol, bodyRows, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=AND(ISNUMBER($' + stockLetter + '2),$' + stockLetter + '2<=5)')
          .setBackground('#FFF1F0')
          .setRanges([stockRange])
          .build()
      );
    }

    if (bodyRows > 0 && overdueCol > 0) {
      const overdueLetter = colToLetter(overdueCol);
      const overdueRange = sheet.getRange(2, overdueCol, bodyRows, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=OR(UPPER($' + overdueLetter + '2)="OVERDUE",$' + overdueLetter + '2=TRUE,$' + overdueLetter + '2=1)')
          .setBackground('#FDECEC')
          .setRanges([overdueRange])
          .build()
      );
    }

    sheet.setConditionalFormatRules(rules);

    const dataRows = Math.max(lastRow - 1, 0);
    grandTotalRows += dataRows;

    if (dataRows > 0) {
      moneyCols.forEach((c) => {
        const vals = sheet.getRange(2, c, dataRows, 1).getValues().flat();
        vals.forEach((v) => {
          const n = parseMoney(v);
          if (!isNaN(n)) grandTotalSales += n;
        });
      });

      if (statusCol > 0) {
        const statusVals = sheet.getRange(2, statusCol, dataRows, 1).getValues().flat().map((v) => String(v || '').toUpperCase().trim());
        statusVals.forEach((v) => {
          if (v === 'PAID' || v === 'SUCCESS') statusCount.PAID++;
          else if (v === 'PENDING') statusCount.PENDING++;
          else if (v === 'FAILED' || v === 'CANCELLED') statusCount.FAILED++;
        });
      }
    }

    report.push(sheet.getName() + ': header, zebra rows, filter, widths, formats, borders, conditional rules applied.');
  });

  writeSummarySheet(ss, grandTotalRows, grandTotalSales, statusCount);

  const reportText = [
    'Premium formatting completed.',
    ...report,
    'Summary: rows=' + grandTotalRows + ', sales=' + grandTotalSales.toFixed(2) + ', paid=' + statusCount.PAID + ', pending=' + statusCount.PENDING + ', failed=' + statusCount.FAILED
  ].join('\n');

  SpreadsheetApp.flush();
  ss.toast('Premium formatting applied successfully.', 'SPLARO', 5);
  Logger.log(reportText);
  return reportText;
}

function writeSummarySheet(ss, totalRows, totalSales, statusCount) {
  let sh = ss.getSheetByName('Summary');
  if (!sh) sh = ss.insertSheet('Summary');
  sh.clear();

  const rows = [
    ['SPLARO SUMMARY', ''],
    ['Generated At', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')],
    ['', ''],
    ['Metric', 'Value'],
    ['Total Rows', totalRows],
    ['Total Sales (BDT)', totalSales],
    ['PAID / SUCCESS', statusCount.PAID],
    ['PENDING', statusCount.PENDING],
    ['FAILED / CANCELLED', statusCount.FAILED]
  ];

  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 2, 220);
  sh.getRange('A1:B1')
    .merge()
    .setBackground('#111827')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);

  sh.getRange('A4:B4')
    .setBackground('#1F2937')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.getRange(5, 1, 5, 2)
    .setFontFamily('Arial')
    .setFontSize(10)
    .setFontColor('#111827');

  sh.getRange('B6').setNumberFormat('"BDT" #,##0.00');

  const body = sh.getRange(4, 1, 6, 2);
  body.setBorder(true, true, true, true, true, true, '#D9DEE7', SpreadsheetApp.BorderStyle.SOLID);
  body.setBorder(true, true, true, true, null, null, '#C4CCD8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function hasAny(text, words) {
  return words.some((w) => text.indexOf(w) !== -1);
}

function findColumns(headers, keywords) {
  const out = [];
  headers.forEach((h, i) => {
    if (hasAny(h, keywords)) out.push(i + 1);
  });
  return out;
}

function findFirstColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    if (hasAny(headers[i], keywords)) return i + 1;
  }
  return 0;
}

function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

function parseMoney(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[^0-9.-]/g, '');
  return s ? parseFloat(s) : NaN;
}
