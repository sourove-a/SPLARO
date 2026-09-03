# Multi-Domain D2C Funnel Platform: Master Roadmap

A complete, phase-by-phase architectural roadmap for deploying the **Universal Multi-Domain D2C Funnel Engine ("Alada Jogot")** across the SPLARO monorepo.

> **The Core Vision:**  
> The store owner can connect **ANY subdomain** (`lifestyle.splaro.co`, `ls.splaro.co`, `shop.splaro.co`, `drop.splaro.co`, etc.) or **ANY custom root domain** (`mybrand.com`, `exclusivewatch.shop`) at any moment directly from the Admin Panel. Each domain is an independent, complete luxury universe with its own theme, custom branding, media showcase, social proof, pixel tracking, and 1-page express checkout, while orders, inventory, and Steadfast courier fulfillment remain centralized in the master admin.

---

## Strategic Phases

### Phase 1: Dynamic Domain Resolution & Multi-Store Backend (`apps/api`)
**Goal:** Enable NestJS & Prisma DB to resolve any arbitrary incoming domain/subdomain on-the-fly and fetch its isolated universe settings.

- [ ] **1.1 Wildcard Subdomain & Custom Host Resolution:**
  - Route: `GET /api/v1/store/resolve-by-host?host=<hostname>`
  - Matches `Store.subdomain` (e.g. `lifestyle`, `ls`, `shop`) OR `Store.domain` (e.g. `coolwatch.com`).
  - Caches resolution in Redis (`store:host:<hostname>`, TTL: 3600s) for 0ms edge response.
  - Returns complete universe config: Store ID, Brand Name, Logo, Active Theme, Active Product, Pixel IDs (FB/TikTok), Delivery Matrix.
- [ ] **1.2 Isolated Order Channel Tagging:**
  - Order model stamps `storeId`, `trafficSource: 'D2C_FUNNEL'`, `landingPage: host`.
  - Captures UTM parameters and ad click IDs (`fbclid`, `ttclid`, `gclid`).
- [ ] **1.3 Zero-Trust Delivery & Bulk Offer Engine:**
  - Server-side delivery fee calculation (Inside Dhaka ৳70, Outside Dhaka ৳130).
  - Bulk discount bundle rules (e.g. Buy 1 = ৳1,450, Buy 2 = ৳2,700 with Free Delivery) verified server-side.

---

### Phase 2: Single Admin "Funnel Universe Hub" (`apps/admin`)
**Goal:** Give the owner complete visual power to spin up, manage, and monitor any domain/subdomain universe in seconds.

- [ ] **2.1 Funnel Universe Hub (`/dashboard/funnels`):**
  - Card-based visual dashboard displaying all active universes:
    - `lifestyle.splaro.co` (Theme: Obsidian Gold | Status: Live | Revenue: ৳74,000)
    - `ls.splaro.co` (Theme: Emerald Velvet | Status: Live)
    - `shop.splaro.co` (Theme: Titanium Silver | Status: Live)
    - `mycustomdrop.com` (Theme: Warm Sand | Status: Live)
  - Floating action button: **`+ Launch New Domain Universe`**
- [ ] **2.2 Universe Creator Drawer / Wizard:**
  - **Step 1: Domain Setup:** Select subdomain (`lifestyle`, `ls`, `shop`, or type custom) OR enter external custom domain.
  - **Step 2: Theme Selector:** Pick from 5 Luxury Presets (Obsidian Gold, Emerald, Titanium, Sand, Sapphire) OR custom hex picker with live preview.
  - **Step 3: Product & Offer:** Select drop product, set headline, bullets, pricing, and bulk bundle tiers.
  - **Step 4: Media & Tracking:** Upload hero video/images, unboxing review photos, and input Facebook Pixel / TikTok Pixel ID.
- [ ] **2.3 Funnel Orders Command Center (`/dashboard/funnels/orders`):**
  - Dedicated order list showing ONLY orders from funnels/drops.
  - Filter by Domain (`All Domains` | `lifestyle.splaro.co` | `ls.splaro.co` | `shop.splaro.co`).
  - Real-time conversion metrics (Orders, COD Delivery Success Rate, Revenue per Ad Campaign).
  - 1-Click Steadfast Courier dispatch directly from row actions.
- [ ] **2.4 Product Isolation Guard:**
  - In `ProductCreatePanel`: Toggle `Channel: [ SPLARO Fashion ] OR [ Funnel Drop: Domain ]`.
  - Zero pollution: Funnel drop products NEVER appear on `splaro.co`.

---

### Phase 3: Standalone High-Performance Funnel App (`apps/funnel`)
**Goal:** An ultra-fast, isolated Next.js application that renders any connected domain universe with zero brand bleed and sub-800ms loading speeds.

- [ ] **3.1 Dynamic Host-Based Shell:**
  - Edge middleware resolves domain host $\rightarrow$ fetches universe config.
  - Dynamically injects theme CSS variables, page title, favicon, and tracking pixels (Facebook/TikTok Pixel scripts).
- [ ] **3.2 Bespoke Editorial Components:**
  - Full-viewport cinematic hero showcase (ambient glow, autoplay silent loop video/portrait photos).
  - 4:5 fashion aspect ratio feature breakdown cards.
  - Customer review wall with verified buyer badges and unboxing photos.
  - Sticky mobile bottom bar with 1-tap jump to order form.
- [ ] **3.3 Frictionless 1-Page Express Checkout:**
  - **Zero login / zero OTP.**
  - Instant BD phone normalizer (`013`–`019`).
  - Dynamic district shipping picker (৳70 / ৳130).
  - Bulk discount pill selector ("1 Piece", "2 Pieces — Save ৳200 + Free Delivery").
  - Cash on Delivery (COD) [Default], bKash, Nagad.
  - Cushioned Visual Haptics CTA button (`scale(0.985)`, 300ms spring damping).
  - Redis-backed double-submit lock (`idempotencyKey`).
- [ ] **3.4 Luxury Order Success Ceremony:**
  - Instant invoice generation (`SPL-####`), WhatsApp support button, live order tracking status.

---

### Phase 4: Production Infrastructure & Wildcard SSL (`infrastructure/vps`)
**Goal:** Effortless DNS and wildcard routing on VPS so any new subdomain works immediately without touching server config.

- [ ] **4.1 Wildcard DNS & Nginx VHost:**
  - Configure `*.splaro.co` CNAME / A record in Cloudflare pointing to VPS `147.93.171.45`.
  - Nginx wildcard server block:
    ```nginx
    server {
        server_name *.splaro.co mycustomdrop.com;
        location / {
            proxy_pass http://127.0.0.1:3002;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```
- [ ] **4.2 Wildcard SSL Certificate:**
  - Let's Encrypt Wildcard SSL `*.splaro.co` so every new subdomain (`lifestyle`, `ls`, `shop`, `vip`, etc.) is automatically HTTPS secured!
- [ ] **4.3 PM2 Ecosystem:**
  - Register `splaro-funnel` on port 3002 in PM2.

---

## Quality & Security Verification Gates

| Gate | Check Command | Success Criteria |
| :--- | :--- | :--- |
| **Backend & Store API** | `pnpm --filter @splaro/api test:unit` | All tests pass, store resolution returns correct universe |
| **Admin Typecheck & UI** | `pnpm check:admin` | 0 errors, 0 warnings, channel badges render |
| **Funnel App Build** | `pnpm --filter @splaro/funnel build` | 0 errors, first load JS < 65KB |
| **End-to-End Order Flow** | Place order on test subdomain | Lands in Admin Funnel Orders with correct domain attribution |
| **Steadfast Booking** | Book test parcel from Funnel Orders | Real consignment generated with zero failures |
| **Performance Score** | Google PageSpeed Insights | Performance $\ge$ 96, LCP < 1.2s, CLS = 0 |
