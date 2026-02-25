# SPLARO Admin Panel Architecture (React + PHP + MySQL)

## Priority Plan
1. P0 Data safety + traceability
   - Transactional writes for order status/refund/cancel
   - `order_status_history` timeline
   - `audit_logs` on all admin writes
2. P0 Customer intelligence
   - `/admin/users` listing with search/status pagination
   - `/admin/users/{id}` complete profile (LTV, purchased products, addresses, activity)
3. P1 Scale readiness
   - Cursor/offset pagination + composite indexes
   - No `SELECT *` on hot endpoints
4. P1 Operational controls
   - User block/unblock, role update, admin note
   - Order refund/cancel/status API with history
5. P2 Dashboard/report depth
   - Top products/customers/refund/cancellation reports
   - Additional analytics filters

## MySQL Model Coverage
- `users`
- `user_addresses`
- `products`
- `product_images`
- `orders`
- `order_items`
- `order_status_history`
- `payments`
- `shipments`
- `refunds`
- `cancellations`
- `subscriptions`
- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_user_roles`
- `admin_user_notes`
- `user_events`
- `audit_logs`
- `system_logs`

## Index Plan
- `users(email)` unique
- `users(phone)`
- `users(role, is_blocked)`
- `users(created_at)`
- `order_items(order_id)`
- `order_items(product_id)`
- `order_items(order_id, product_id, created_at)`
- `order_status_history(order_id, created_at)`
- `payments(order_id, status, created_at)`
- `shipments(order_id, status, created_at)`
- `refunds(order_id, status, created_at)`
- `refunds(user_id, created_at)`
- `cancellations(order_id, status, created_at)`
- `cancellations(user_id, created_at)`
- `admin_user_notes(user_id, created_at)`
- `user_events(user_id, created_at)`

## Admin API Route Map (`/api/index.php?action=...`)

### Users
- `GET admin_users?search=&status=&page=&limit=&cursor=`
- `GET admin_user_profile?id=`
- `GET admin_user_stats?id=`
- `GET admin_user_orders?id=&page=&limit=&q=&status=`
- `GET admin_user_activity?id=&page=&limit=`
- `POST admin_user_note` body: `{ id, note }`
- `POST admin_user_block` body: `{ id, blocked }`
- `POST admin_user_role` body: `{ id, role }`

### Orders
- `GET admin_orders?status=&date_from=&date_to=&search=&page=&limit=&cursor=`
- `GET admin_order_detail?id=`
- `GET admin_order_timeline?id=`
- `POST admin_order_status` body: `{ id, status, note? }`
- `POST admin_order_cancel` body: `{ id, reason? }`
- `POST admin_order_refund` body: `{ id, amount?, reason? }`

### Reports
- `GET admin_reports_summary?range=today|week|month`
- `GET admin_reports_top_products?limit=`
- `GET admin_reports_top_customers?limit=`
- `GET admin_reports_cancellations?limit=`
- `GET admin_reports_refunds?limit=`

## Frontend Admin Structure
- `components/AdminPanel.tsx`
  - Users table (server-driven pagination/filter)
  - Customer profile modal
  - Purchased products, order history, activity timeline, notes
  - User block/unblock and role actions

## Reliability Rules
- All write endpoints require:
  - Admin auth
  - CSRF token
  - Audit + system log
- Multi-step writes use DB transactions:
  - Order status update
  - Cancel
  - Refund
  - Checkout order create + line items + initial timeline
