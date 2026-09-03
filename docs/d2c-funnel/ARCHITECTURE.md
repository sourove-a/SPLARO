# Multi-Domain D2C Funnel: Technical Architecture

This document specifies the technical architecture, data structures, network routing, and security protocols powering SPLARO's Multi-Domain D2C Funnel Platform.

---

## 1. Domain Resolution & Routing Mechanics

```
                     Incoming HTTP Request
              Host: lifestyle.splaro.co (or custom.com)
                                │
                                ▼
                       Nginx Reverse Proxy
                     (Port 80/443 SSL SNI)
                                │
                                ▼
                    Next.js Edge Middleware
                    (`apps/funnel/middleware.ts`)
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
         Redis Cache Hit (0ms)       Redis Cache Miss
        Key: store:host:<domain>             │
                   │                         ▼
                   │              NestJS API Request
                   │       GET /api/v1/store/resolve-by-host
                   │                         │
                   │                         ▼
                   │              Prisma DB Store Lookup
                   │                         │
                   │                         ▼
                   └───────────► Populate Redis (TTL: 1hr)
                                             │
                                             ▼
                               Render Standalone Funnel
                           Inject Dynamic Theme & Product
```

---

## 2. Database Model & Multi-Tenant Mapping

The architecture natively maps to Prisma's existing `Store` model:

```prisma
model Store {
  id               String       @id @default(cuid())
  name             String
  slug             String       @unique
  domain           String?      @unique    // e.g. "coolgadget.shop"
  subdomain        String?      @unique    // e.g. "lifestyle"
  isActive         Boolean      @default(true)
  settings         SiteSettings?
  products         Product[]
  orders           Order[]
  ...
}
```

### Order Placement Attribution
When an order is created through the funnel, the following fields are permanently stamped in the `Order` model:
- `storeId`: Set to the specific `Store.id` resolved from the host.
- `trafficSource`: Stamped as `D2C_FUNNEL`.
- `landingPage`: Stamped with the exact URL (e.g. `https://lifestyle.splaro.co/drop/midnight-chrono`).
- `utmSource`, `utmCampaign`, `fbclid`: Captured from visitor query params for marketing ROI analysis.

---

## 3. Zero-Trust Security & Anti-Fraud Protections

1. **Server-Side Price Calculation:**
   - The client form never submits price amounts.
   - The server resolves the `productId`, fetches the active database price, and computes:
     $$\text{Total} = (\text{Item Price} \times \text{Quantity}) + \text{Delivery Fee} - \text{Discount}$$
2. **Delivery Fee Integrity:**
   - Evaluated using `packages/config/src/delivery-zones.ts`.
   - Inside Dhaka: ৳70 | Outside Dhaka: ৳130.
3. **Idempotency & Double-Click Protection:**
   - A UUID `idempotencyKey` is minted by the browser on form load.
   - Redis enforces an atomic `SET NX EX 60` lock on the key, guaranteeing no duplicate orders if a user taps "Confirm Order" multiple times.
4. **Rate Limiting:**
   - Redis-backed IP rate limiter restricts submissions to 5 orders per 15 minutes per IP.
