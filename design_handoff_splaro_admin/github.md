repo: sourove-a/SPLARO
branch: main

## Last sync
date: 2026-07-28T18:47:07Z

### Updated in this project
- Added **Warehouse & Stock (WMS)** — warehouses, transfers with the real PENDING → IN_TRANSIT → COMPLETED state machine, and the stock movement ledger with all nine `StockMovementReason` values.
- Added **Purchase Orders** — suppliers, POs and goods-received notes, wired to the Inventory "Create PO" decision cards.
- Added **SMS Center** — the real BDBulkSMS → ElitBuzz → GreenWeb provider chain, Bangla/English segment costing, and the `SEND_SMS` automation link.
- Added **Bulk & CSV** and **Google Sheets** — bulk stock/publish against the endpoints that exist, an honest "not built" state for bulk price, and the Sheets cron + retry flow.

## Screen map
| Project screen | Built from |
| --- | --- |
| Warehouse & Stock (`wms`) | `apps/api/src/modules/commerce-os/commerce-os.service.ts` (`wmsOverview`, `recordStockMovement`, `createStockTransfer`, `shipStockTransfer`, `receiveStockTransfer`), `commerce-os.controller.ts` |
| Purchase Orders (`procurement`) | `apps/api/src/modules/commerce-os/commerce-os.service.ts` (`procurementOverview`, `procurementSuppliers`, `procurementOrders`, `procurementGrns`), `apps/api/src/modules/admin-hub/admin-hub.controller.ts` |
| SMS Center (`sms`) | `apps/api/src/modules/notifications/sms.service.ts`, `apps/api/src/modules/automation/automation.service.ts` (`SEND_SMS`) |
| Bulk & CSV (`bulk`) | `apps/api/src/modules/products/products.controller.ts` (`bulk/stock`, `bulk/publish`), `apps/api/src/modules/reports/reports.controller.ts` (`orders/export-csv`), `apps/api/src/modules/customers/customers.controller.ts` (`export-csv`) |
| Google Sheets (`sheets`) | `apps/api/src/modules/integrations/integrations.controller.ts` (`google-sheets/status`, `/syncs`, `/retry-failed`), `apps/api/src/modules/google-workspace/google-sheets-sync.service.ts`, `google-sheets-live.cron.ts` |
| Orders / Customers phone format | `apps/api/src/modules/notifications/sms.service.ts` (`normalizePhone`) |
| Settings (11 sections) | `apps/api/src/common/api-routes.manifest.ts` |
| Shell / nav | `apps/admin/src/lib/navigation/admin-nav`, `apps/admin/src/app/dashboard/[...slug]/page.tsx` |

## Not yet reflected in the design
- `commerce-os` Production (fabric inventory, production batches), Delivery agents, Company/HR (employees, payroll, tasks) and Helpdesk tickets all have working APIs but no screen here.
- No bulk **price** endpoint exists upstream (`POST /products/bulk/price`) — the Bulk & CSV screen shows this as an explicit blocked state rather than faking it.
