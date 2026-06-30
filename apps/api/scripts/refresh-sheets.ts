import 'reflect-metadata'
import { config } from 'dotenv'
import { resolve } from 'path'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { GoogleSheetsSyncService } from '../src/modules/google-workspace/google-sheets-sync.service'

config({ path: resolve(__dirname, '../../../.env') })

async function main() {
  const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] })
  try {
    const sheets = app.get(GoogleSheetsSyncService)
    const result = await sheets.refreshBusinessSpreadsheet(storeId, 'refresh_script')
    console.log('OK', JSON.stringify(result, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((e) => {
  console.error('FAIL', e?.stack ?? e?.message ?? e)
  process.exit(1)
})
