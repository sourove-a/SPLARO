# SPLARO Critical Flows

## 1. Checkout Flow (Atomic)
1. Client sends selected items, address, shipping method, coupon code.
2. Server re-fetches product variants and validates stock.
3. Server validates coupon scope, limits, expiry, per-user limit.
4. Server calculates totals (subtotal, shipping, discount, payable).
5. Server creates `Order` in `PAYMENT_PENDING` and creates `OrderItem` snapshots.
6. Server reserves inventory (`reservedStock += qty`) in a DB transaction.
7. Server creates `Payment` with `INITIATED` status + idempotency key.
8. Server returns payment initiation payload (gateway redirect/session).

## 2. Payment Callback/Webhook Flow (Authoritative)
1. Gateway calls webhook/callback with transaction data.
2. Verify signature/hash and timestamp window.
3. Enforce replay protection using unique event ID/idempotency key.
4. Lock payment record (`SELECT ... FOR UPDATE` style with Prisma transaction workaround).
5. If already final (`PAID/FAILED/CANCELED/REFUNDED`), return success (idempotent no-op).
6. Verify transaction with gateway verify API.
7. On verified success:
   - mark `Payment` = `PAID`
   - mark `Order` = `PAID` then `PROCESSING`
   - convert inventory reservation to deduction (`stockOnHand -= qty`, `reservedStock -= qty`)
   - create `TransactionLog` and `AuditLog`
   - trigger invoice + notifications
8. On failure/cancel:
   - mark payment/order failed/canceled
   - release reserved inventory
   - write logs and notify user

## 3. Inventory Reservation and Oversell Protection
- Reservation happens only on server
- Use per-variant transactional checks:
  - ensure `stockOnHand - reservedStock >= requestedQty`
- Reservation TTL job clears stale unpaid orders
- On payment failure/cancel/timeout, reservation is released automatically

## 4. Return and Refund Flow
1. User submits `ReturnRequest` with reason + optional evidence.
2. System validates policy window and order/item eligibility.
3. Admin approves/rejects.
4. If approved, create reverse shipment (pickup/tracking).
5. On item received and QC pass, admin triggers refund.
6. Refund service calls gateway refund API.
7. On success:
   - `Refund` -> `REFUNDED`
   - `Payment` -> `REFUNDED` (full/partial metadata)
   - `Order` -> `COMPLETED` or `PARTIALLY_REFUNDED` strategy
   - write `TransactionLog`, `AuditLog`, notify user

## 5. Shipment Status Flow
- Admin/3PL updates shipment state
- System updates `Shipment` and order status mapping:
  - `IN_TRANSIT` -> order `SHIPPED`
  - `DELIVERED` -> order `DELIVERED`
  - completion job promotes to `COMPLETED` after return-window rule
- Each transition emits notification and audit entry

