# SPLARO Route Map and API Contract

## 1. Route Map

### Public Storefront
- `/` home
- `/shop` listing page
- `/shop?category=&brand=&priceMin=&priceMax=&sort=` filtered listing
- `/products/[slug]` product detail with variant selectors
- `/cart`
- `/checkout`
- `/order-success/[orderId]`
- `/wishlist`
- `/story`
- `/support`

### Auth
- `/login`
- `/register`
- `/verify-otp`
- `/forgot-password`
- `/reset-password`
- `/setup-2fa`

### User Dashboard
- `/user`
- `/user/orders`
- `/user/orders/[orderId]`
- `/user/addresses`
- `/user/wishlist`
- `/user/returns`
- `/user/notifications`
- `/user/security`

### Admin Dashboard
- `/admin`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/[id]/edit`
- `/admin/inventory`
- `/admin/orders`
- `/admin/orders/[orderId]`
- `/admin/returns`
- `/admin/refunds`
- `/admin/users`
- `/admin/coupons`
- `/admin/campaigns`
- `/admin/reviews`
- `/admin/cms`
- `/admin/analytics`
- `/admin/settings`

## 2. API Endpoints (BFF)

### Auth + Identity
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/2fa/enable`
- `POST /api/auth/2fa/verify`

### Catalog
- `GET /api/products`
- `GET /api/products/[slug]`
- `POST /api/admin/products`
- `PATCH /api/admin/products/[id]`
- `DELETE /api/admin/products/[id]`
- `POST /api/admin/products/bulk-import`

### Inventory
- `GET /api/admin/inventory`
- `POST /api/admin/inventory/adjust`
- `POST /api/inventory/reserve`
- `POST /api/inventory/release`

### Cart + Checkout
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/[itemId]`
- `DELETE /api/cart/items/[itemId]`
- `POST /api/cart/merge`
- `POST /api/checkout/preview`
- `POST /api/checkout/place-order`

### Coupon
- `POST /api/coupons/apply`
- `POST /api/admin/coupons`
- `PATCH /api/admin/coupons/[id]`
- `POST /api/admin/coupons/[id]/disable`

### Orders
- `GET /api/orders`
- `GET /api/orders/[orderId]`
- `POST /api/orders/[orderId]/cancel`
- `PATCH /api/admin/orders/[orderId]/status`
- `GET /api/orders/[orderId]/invoice`

### Payments
- `POST /api/payments/initiate`
- `GET /api/payments/status/[paymentId]`
- `POST /api/payments/verify`
- `POST /api/webhooks/payments/sslcommerz`
- `POST /api/webhooks/payments/stripe`

### Returns + Refunds
- `POST /api/returns`
- `GET /api/returns/[returnId]`
- `PATCH /api/admin/returns/[returnId]`
- `POST /api/admin/refunds`
- `GET /api/admin/refunds/[refundId]`

### Reviews
- `POST /api/reviews`
- `PATCH /api/admin/reviews/[id]/moderate`
- `GET /api/products/[slug]/reviews`

### User + Notifications
- `GET /api/user/profile`
- `PATCH /api/user/profile`
- `GET /api/user/addresses`
- `POST /api/user/addresses`
- `PATCH /api/user/addresses/[id]`
- `DELETE /api/user/addresses/[id]`
- `GET /api/notifications`
- `PATCH /api/notifications/[id]/read`

### Admin Ops + Analytics
- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/sales`
- `GET /api/admin/users`
- `PATCH /api/admin/users/[id]/status`
- `GET /api/admin/audit-logs`

## 3. Critical Status Machines
- Order: `CREATED -> PAYMENT_PENDING -> PAID -> PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED`
- Payment: `INITIATED -> PENDING -> PAID | FAILED | CANCELED -> REFUNDED`
- Shipment: `PENDING -> PICKED -> IN_TRANSIT -> DELIVERED | RETURNED`
- Return: `REQUESTED -> APPROVED | REJECTED -> PICKUP_SCHEDULED -> RECEIVED -> REFUND_INITIATED -> REFUNDED -> CLOSED`

