import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { GoogleSheetsSyncService } from '../src/modules/google-workspace/google-sheets-sync.service'
import { GoogleServiceAccountService } from '../src/modules/google-workspace/google-service-account.service'

async function main() {
  const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
  const spreadsheetId = process.env.GOOGLE_DEFAULT_SPREADSHEET_ID?.trim()
  if (!spreadsheetId) throw new Error('GOOGLE_DEFAULT_SPREADSHEET_ID missing')

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] })
  try {
    const sa = app.get(GoogleServiceAccountService)
    const sheets = app.get(GoogleSheetsSyncService)
    await sa.activateStore(storeId, 'link_script')
    const result = await sheets.linkExistingSpreadsheet(storeId, spreadsheetId, 'link_script')
    console.log('OK', JSON.stringify(result, null, 2))
    console.log(`Open: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`)
  } finally {
    await app.close()
  }
}

main().catch((e) => {
  console.error('FAIL', e?.message ?? e)
  process.exit(1)
})
