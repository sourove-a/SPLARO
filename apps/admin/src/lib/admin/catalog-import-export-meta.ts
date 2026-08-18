const CATALOG_IMPORT_CHUNK_SIZE = 200

export const BULK_CSV_WORKSPACE_LABEL = 'Bulk & CSV'
export const BULK_CSV_OPEN_LABEL = 'Open Bulk & CSV'

export function formatCatalogProductsSyncLabel(total: number): string {
  return `${total.toLocaleString()} product${total === 1 ? '' : 's'}`
}

export function formatCatalogPublishedSub(published: number): string {
  return `${published.toLocaleString()} live on store`
}

export function formatCatalogBulkIntro(modeLabel: string, isCatalog: boolean): string {
  if (isCatalog) {
    return `1. Download template · 2. One row per variant · 3. Dry-run preview · 4. Apply in ${CATALOG_IMPORT_CHUNK_SIZE}-row API batches. Same file shape as Export all products.`
  }
  return `Upload a ${modeLabel.toLowerCase()} file — dry-run shows rejects before anything is written.`
}

export function formatCatalogBulkTemplateSubtitle(columns: string): string {
  return `${columns.slice(0, 72)}${columns.length > 72 ? '…' : ''} · write batches capped at ${CATALOG_IMPORT_CHUNK_SIZE} rows`
}
