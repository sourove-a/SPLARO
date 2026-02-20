import { NextResponse } from 'next/server';
import { getStorageSummary } from '../../../lib/adminPersistence';

export async function GET() {
  const storage = await getStorageSummary();
  return NextResponse.json({
    ok: true,
    storage: storage.storage,
    dbHost: storage.dbHost,
    dbName: storage.dbName,
  });
}
