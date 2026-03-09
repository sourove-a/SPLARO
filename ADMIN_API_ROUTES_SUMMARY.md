# Splaro Admin API Routes - Complete Documentation

All admin API routes have been successfully created at `/app/api/admin/`. Each route requires the `x-admin-key` or `Authorization: Bearer` header with the `ADMIN_KEY` environment variable value.

## Routes Created

### 1. Reviews Management
**Path:** `/app/api/admin/reviews/`

#### GET `/app/api/admin/reviews/route.ts`
- List all product reviews with pagination
- Query Parameters:
  - `page` (default: 1)
  - `limit` (default: 20, max: 50)
  - `status` (optional filter)
- Returns: `{ reviews[], total, page, limit }`

#### PATCH `/app/api/admin/reviews/[id]/route.ts`
- Update review status, feature flag, or admin notes
- Body: `{ status?, isFeatured?, adminNote? }`
- Returns: Updated review object

#### DELETE `/app/api/admin/reviews/[id]/route.ts`
- Delete a review
- Returns: `{ ok: true }`

---

### 2. Inventory Management
**Path:** `/app/api/admin/inventory/`

#### GET `/app/api/admin/inventory/route.ts`
- View inventory logs and stock status
- Query Parameters:
  - `page` (default: 1, limit: 50 per page)
  - `productId` (optional filter)
  - `type` (optional: STOCK_IN, STOCK_OUT, SALE, RETURN, DAMAGE, ADJUSTMENT)
- Returns: `{ logs[], total, page, lowStock[], outOfStock }`
- Includes low stock alerts (qty <= 5)

#### POST `/app/api/admin/inventory/route.ts`
- Create inventory adjustment/transaction
- Body:
  ```
  {
    productId: number (required),
    type: string (required - STOCK_IN, STOCK_OUT, SALE, RETURN, DAMAGE, ADJUSTMENT),
    qty: number (required),
    reason?: string,
    reference?: string,
    performedBy?: string
  }
  ```
- Returns: `{ log, newQty }`

---

### 3. Returns Management
**Path:** `/app/api/admin/returns/`

#### GET `/app/api/admin/returns/route.ts`
- List return requests with pagination
- Query Parameters:
  - `page` (default: 1)
  - `status` (optional filter)
  - `type` (optional filter)
- Returns: `{ requests[], total, page }`

#### GET `/app/api/admin/returns/[id]/route.ts`
- Get detailed return request information
- Returns: `{ request }`

#### PATCH `/app/api/admin/returns/[id]/route.ts`
- Update return status, refund info, or notes
- Body:
  ```
  {
    status?: string,
    refundStatus?: string,
    refundAmount?: number,
    adminNote?: string
  }
  ```
- Returns: Updated request object

---

### 4. Content Management
**Path:** `/app/api/admin/content/`

#### GET `/app/api/admin/content/route.ts`
- List all content blocks
- Query Parameters:
  - `type` (optional filter)
- Returns: `{ blocks[] }`

#### POST `/app/api/admin/content/route.ts`
- Create new content block
- Body:
  ```
  {
    key: string (required),
    type: string (required),
    title?: string,
    subtitle?: string,
    body?: string,
    imageUrl?: string,
    linkUrl?: string,
    linkText?: string,
    isPublished?: boolean (default: true),
    displayOrder?: number (default: 0),
    metadata?: object
  }
  ```
- Returns: Created block object (status: 201)

#### PATCH `/app/api/admin/content/[id]/route.ts`
- Update content block
- Body: Any of the POST fields
- Returns: Updated block object

#### DELETE `/app/api/admin/content/[id]/route.ts`
- Delete content block
- Returns: `{ ok: true }`

---

### 5. Media Management
**Path:** `/app/api/admin/media/`

#### GET `/app/api/admin/media/route.ts`
- List uploaded media files with pagination
- Query Parameters:
  - `page` (default: 1, limit: 40 per page)
- Returns: `{ files[], total, page }`

#### POST `/app/api/admin/media/route.ts`
- Upload new media file
- Content-Type: multipart/form-data
- Form Fields:
  - `file` (required, File)
  - `altText` (optional, string)
  - `uploadedBy` (optional, string, default: 'admin')
- Saves to: `/public/uploads/`
- Returns: `{ file }` (status: 201)

---

### 6. Shipping Zones
**Path:** `/app/api/admin/shipping/`

#### GET `/app/api/admin/shipping/route.ts`
- List all shipping zones
- Returns: `{ zones[] }`

#### POST `/app/api/admin/shipping/route.ts`
- Create new shipping zone
- Body:
  ```
  {
    name: string (required),
    shippingFee: number (required),
    description?: string,
    estimatedDays?: number,
    freeShippingAbove?: number,
    isCodAvailable?: boolean (default: true),
    isActive?: boolean (default: true)
  }
  ```
- Returns: Created zone object (status: 201)

#### PATCH `/app/api/admin/shipping/route.ts`
- Update shipping zone
- Body:
  ```
  {
    id: number (required),
    ... any zone fields to update
  }
  ```
- Returns: Updated zone object

---

### 7. Admin Notifications
**Path:** `/app/api/admin/notifications/`

#### GET `/app/api/admin/notifications/route.ts`
- Fetch admin notifications
- Query Parameters:
  - `unread` (optional: 'true' to filter unread only)
- Returns: `{ notifications[], unreadCount }`

#### PATCH `/app/api/admin/notifications/route.ts`
- Mark notifications as read
- Body:
  ```
  {
    markAllRead?: boolean,
    id?: number (to mark single notification)
  }
  ```
- Returns: `{ ok: true }`

---

## Authentication

All routes use the `adminOk()` helper function which checks:
1. `x-admin-key` header, OR
2. `Authorization: Bearer <token>` header

Both must match the `ADMIN_KEY` environment variable value.

**Example requests:**
```bash
# Using x-admin-key header
curl -H "x-admin-key: your-secret-key" \
  https://example.com/api/admin/reviews

# Using Authorization header
curl -H "Authorization: Bearer your-secret-key" \
  https://example.com/api/admin/reviews
```

---

## File Structure

```
/app/api/admin/
├── reviews/
│   ├── route.ts (GET, POST reviews)
│   └── [id]/
│       └── route.ts (PATCH, DELETE single review)
├── inventory/
│   └── route.ts (GET logs, POST adjustments)
├── returns/
│   ├── route.ts (GET return requests)
│   └── [id]/
│       └── route.ts (GET, PATCH single return)
├── content/
│   ├── route.ts (GET, POST content blocks)
│   └── [id]/
│       └── route.ts (PATCH, DELETE content block)
├── media/
│   └── route.ts (GET, POST file uploads)
├── shipping/
│   └── route.ts (GET, POST, PATCH zones)
└── notifications/
    └── route.ts (GET, PATCH notifications)
```

---

## Notes

- All responses use HTTP status codes appropriately (201 for creates, 401 for auth failures, 404 for not found)
- Pagination defaults to 20-50 items per page depending on route
- Inventory adjustments automatically update product stock quantities
- Media files are saved to `/public/uploads/` with timestamped filenames
- All database operations use Prisma ORM
- Routes use `runtime = 'nodejs'` for Next.js 13+ App Router
