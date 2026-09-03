---
name: d2c-funnel-engine
description: >-
  Multi-Domain D2C High-Converting Product Funnel Platform for SPLARO monorepo.
  Covers custom domain/subdomain mapping (lifestyle.splaro.co, ls.splaro.co, shop.splaro.co, custom drops),
  dynamic luxury theme engine (Obsidian Gold, Emerald, Titanium, Sand, Custom Hex),
  1-page frictionless express checkout (no login, no OTP), visual haptics,
  and single central admin panel integration (isolated products, orders, themes).
  Use whenever user asks about funnels, custom landing pages, subdomains,
  lifestyle drops, single-product sales, or multi-storefront architecture.
---

# SPLARO D2C Funnel Engine — Master Technical Manual

> **Scope:** Universal multi-domain/subdomain funnel platform ("Alada Jogot"), dynamic theme engine, 1-page frictionless express checkout, visual haptics motion, single-admin operational isolation, and unified Steadfast fulfillment.

Read this skill **before** creating, modifying, deploying, or debugging any funnel, landing page, custom domain, or multi-storefront component in the SPLARO-BRAND monorepo.

---

## 1. Executive Principles & Brand Law ("Alada Jogot")

1. **The "Alada Jogot" Rule (Complete Universe Isolation):**
   - The store owner can spin up **ANY subdomain** (`lifestyle.splaro.co`, `ls.splaro.co`, `shop.splaro.co`, `vip.splaro.co`, `drop.splaro.co`) or **ANY custom root domain** (`mybrand.com`, `exclusivewatch.shop`) at any time directly from the Admin Panel.
   - Each domain represents a completely separate universe:
     - Independent Brand Name & Custom Logo.
     - Independent Theme Color Story (Obsidian Gold, Emerald, Titanium, Sand, Sapphire, or Custom Hex).
     - Independent Media Showcase (Cinematic 4K Autoplay Video / Portrait Photo Gallery).
     - Independent Ad Pixel Tracking (Dedicated Facebook Pixel & TikTok Pixel IDs).
     - Independent Pricing & Bulk Bundle Tiers (e.g. "Buy 1 for ৳1,450", "Buy 2 for ৳2,700 - Free Shipping!").
     - Independent Frictionless 1-Page Checkout (Zero login, zero OTP).
   - **Zero connection or visual bleed to `splaro.co`**. No shared fashion headers, footers, or category links.

2. **Single Unified Operational Brain:**
   - All domain universes connect to the single master **SPLARO Admin Panel** (`apps/admin`) and central **NestJS API** (`apps/api`).
   - Store owners never switch between different admin URLs or courier logins.
   - Centralized inventory, automated Steadfast courier dispatches, and Telegram notifications.

3. **Zero-Friction Conversion (The Bangladesh Ad Law):**
   - **NO mandatory account creation.**
   - **NO passwords.**
   - **NO OTP gating before order confirmation.**
   - Customer sees the video/photo showcase $\rightarrow$ scrolls to the embedded form $\rightarrow$ enters Name + Phone + Address $\rightarrow$ taps **"অর্ডার কনফার্ম করুন"** $\rightarrow$ Done in under 15 seconds.

4. **Tactile Visual Haptics:**
   - Interactions mimic physical organic materials through 300ms spring damping (`cubic-bezier(0.25, 1, 0.5, 1)`), 1.5% cushioned micro-depression (`scale(0.985)`), and 700ms cinematic zooms.

---

## 2. Monorepo Port & Architecture Map

| App / Service | Port | Domain / Routing | Primary Role |
| :--- | :--- | :--- | :--- |
| `apps/web` | `:3000` | `https://splaro.co` | Main Luxury Fashion Flagship Storefront |
| `apps/admin` | `:3001` | `https://admin.splaro.co` | Central Master Dashboard (All Stores, Funnels & Channels) |
| `apps/funnel` | `:3002` | `https://*.splaro.co` & Custom Domains | Universal Standalone Funnel Engine |
| `apps/api` | `:4000` | `https://api.splaro.co` (`/api/v1`) | Central NestJS Backend, Prisma DB, Redis, Steadfast |

---

## 3. Universal Wildcard & Domain Resolution Engine

### Host Resolution Pipeline
```
[ Request hits: lifestyle.splaro.co OR ls.splaro.co OR shop.splaro.co OR custom.com ]
                                        │
                                        ▼
                     Nginx Reverse Proxy (*.splaro.co / SSL SNI)
                                        │
                                        ▼
                     Next.js Edge Middleware (`apps/funnel`)
                      `const host = req.headers.get('host')`
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
               Redis Cache Hit (0ms)          Redis Cache Miss
              Key: `store:host:${host}`                │
              Payload: Cached Store JSON               ▼
                         │                    NestJS API Call
                         │             `GET /api/v1/store/resolve-by-host?host=...`
                         │                             │
                         │                             ▼
                         │                  Prisma PostgreSQL Query
                         │             `Store.findFirst({ where: { OR: [{domain}, {subdomain}] } })`
                         │                             │
                         │                             ▼
                         └─────────────────► Write to Redis (TTL: 3600s)
                                                       │
                                                       ▼
                                       Render Standalone Universe
                                    Theme + Product + Media + Pixels
```

### Database Schema Contract (`packages/database/prisma/schema.prisma`)
The system utilizes the native multi-tenant `Store` model (Lines 509–550):
```prisma
model Store {
  id               String       @id @default(cuid())
  name             String
  slug             String       @unique
  domain           String?      @unique    // e.g. "mycustomdrop.com"
  subdomain        String?      @unique    // e.g. "lifestyle", "ls", "shop"
  logo             String?
  favicon          String?
  currency         String       @default("BDT")
  isActive         Boolean      @default(true)
  settings         SiteSettings?
  products         Product[]
  orders           Order[]
}
```

---

## 4. Dynamic Luxury Theme Engine

The funnel engine dynamically injects CSS custom properties into `:root` based on the resolved product/store configuration.

### 5 Curated Luxury Presets

#### 1. 👑 Obsidian & Champagne Gold (`data-theme="obsidian-gold"`)
- **Psychology:** Ultra-luxury, Swiss horology, private banking, moody drama.
```css
:root[data-theme="obsidian-gold"] {
  --funnel-bg: #0b0c0e;
  --funnel-surface: #14161a;
  --funnel-surface-glass: rgba(20, 22, 26, 0.72);
  --funnel-border: rgba(200, 169, 126, 0.22);
  --funnel-accent: #c8a97e;
  --funnel-accent-hover: #dfc298;
  --funnel-accent-glow: rgba(200, 169, 126, 0.35);
  --funnel-text-primary: #ffffff;
  --funnel-text-muted: #8e939e;
  --funnel-btn-bg: linear-gradient(135deg, #c8a97e 0%, #a8824b 100%);
  --funnel-btn-text: #0b0c0e;
  --funnel-shadow-color: rgba(0, 0, 0, 0.6);
}
```

#### 2. 🌿 Midnight Emerald Velvet (`data-theme="emerald-velvet"`)
- **Psychology:** Royal heritage, artisanal craftsmanship, deep botanicals.
```css
:root[data-theme="emerald-velvet"] {
  --funnel-bg: #07120c;
  --funnel-surface: #0e1f16;
  --funnel-surface-glass: rgba(14, 31, 22, 0.75);
  --funnel-border: rgba(46, 125, 82, 0.28);
  --funnel-accent: #34d399;
  --funnel-accent-hover: #6ee7b7;
  --funnel-accent-glow: rgba(52, 211, 153, 0.3);
  --funnel-text-primary: #f0fdf4;
  --funnel-text-muted: #86efac;
  --funnel-btn-bg: linear-gradient(135deg, #059669 0%, #047857 100%);
  --funnel-btn-text: #ffffff;
  --funnel-shadow-color: rgba(2, 20, 10, 0.7);
}
```

#### 3. ⚙️ Titanium Precision Silver (`data-theme="titanium-silver"`)
- **Psychology:** Apple-level industrial design, EDC gear, frosted crystal, modern tech.
```css
:root[data-theme="titanium-silver"] {
  --funnel-bg: #0d0f12;
  --funnel-surface: #171a20;
  --funnel-surface-glass: rgba(23, 26, 32, 0.78);
  --funnel-border: rgba(255, 255, 255, 0.16);
  --funnel-accent: #e2e8f0;
  --funnel-accent-hover: #ffffff;
  --funnel-accent-glow: rgba(226, 232, 240, 0.22);
  --funnel-text-primary: #ffffff;
  --funnel-text-muted: #94a3b8;
  --funnel-btn-bg: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
  --funnel-btn-text: #0f172a;
  --funnel-shadow-color: rgba(0, 0, 0, 0.65);
}
```

#### 4. 🏜️ Warm Mediterranean Sand (`data-theme="warm-sand"`)
- **Psychology:** Artisanal leather, raw linen, Tuscan sun, warm earth elegance.
```css
:root[data-theme="warm-sand"] {
  --funnel-bg: #14110f;
  --funnel-surface: #201b17;
  --funnel-surface-glass: rgba(32, 27, 23, 0.75);
  --funnel-border: rgba(212, 154, 106, 0.25);
  --funnel-accent: #d49a6a;
  --funnel-accent-hover: #e4ae82;
  --funnel-accent-glow: rgba(212, 154, 106, 0.3);
  --funnel-text-primary: #fffaf5;
  --funnel-text-muted: #aba092;
  --funnel-btn-bg: linear-gradient(135deg, #d49a6a 0%, #b57a46 100%);
  --funnel-btn-text: #14110f;
  --funnel-shadow-color: rgba(15, 10, 8, 0.7);
}
```

#### 5. 💎 Royal Sapphire Midnight (`data-theme="sapphire-midnight"`)
- **Psychology:** Deep ocean prestige, executive authority, midnight chronograph.
```css
:root[data-theme="sapphire-midnight"] {
  --funnel-bg: #060b14;
  --funnel-surface: #0d1728;
  --funnel-surface-glass: rgba(13, 23, 40, 0.76);
  --funnel-border: rgba(59, 130, 246, 0.26);
  --funnel-accent: #60a5fa;
  --funnel-accent-hover: #93c5fd;
  --funnel-accent-glow: rgba(96, 165, 250, 0.32);
  --funnel-text-primary: #eff6ff;
  --funnel-text-muted: #93c5fd;
  --funnel-btn-bg: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  --funnel-btn-text: #ffffff;
  --funnel-shadow-color: rgba(2, 6, 15, 0.8);
}
```

#### 🎨 Custom Hex Mathematical Mode
When the store manager specifies an ad-hoc brand hex code (e.g. `#8B1E3F`), the CSS engine dynamically calculates complementary tints using standard CSS `color-mix()`:
```css
:root[data-theme="custom"] {
  --funnel-accent: var(--custom-primary-hex);
  --funnel-bg: color-mix(in srgb, var(--custom-primary-hex) 4%, #0a0b0d);
  --funnel-surface: color-mix(in srgb, var(--custom-primary-hex) 10%, #131519);
  --funnel-border: color-mix(in srgb, var(--custom-primary-hex) 25%, transparent);
  --funnel-accent-glow: color-mix(in srgb, var(--custom-primary-hex) 35%, transparent);
  --funnel-btn-bg: linear-gradient(135deg, var(--custom-primary-hex) 0%, color-mix(in srgb, var(--custom-primary-hex) 75%, black) 100%);
  --funnel-btn-text: #ffffff;
}
```

---

## 5. Visual Haptics & Physics Specifications

### Tactical Button Spring Damping (No Hard Clicks)
```css
.funnel-cta-button {
  transition: 
    transform 300ms cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 300ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 300ms cubic-bezier(0.25, 1, 0.5, 1),
    filter 300ms cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
  transform: translateZ(0);
}

.funnel-cta-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.005);
  box-shadow: 0 12px 28px -6px var(--funnel-accent-glow);
}

.funnel-cta-button:active:not(:disabled) {
  transform: scale(0.985); /* Cushioned 1.5% micro-depression */
  opacity: 0.90;
  box-shadow: 0 4px 12px -2px var(--funnel-accent-glow);
  transition-duration: 80ms; /* Fast compress, slow spring release */
}
```

### 700ms Slow Luxury Image Hover
```css
.funnel-media-container {
  overflow: hidden;
  border-radius: 16px;
  position: relative;
  isolation: isolate;
}

.funnel-media-container img,
.funnel-media-container video {
  transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms ease-out;
  will-change: transform;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
}

.funnel-media-container:hover img,
.funnel-media-container:hover video {
  transform: scale(1.045);
}
```

---

## 6. Frictionless 1-Page Express Checkout Protocol

### Form Fields & Validation Specifications
```typescript
export interface FunnelOrderPayload {
  storeId: string;            // Resolved Store ID
  productId: string;          // Target drop item ID
  variantId?: string;         // Optional color/size variant
  quantity: number;           // Quantity (1, 2, 3 with bulk discount pills)
  customerName: string;       // Min 2 chars, trimmed
  customerPhone: string;      // BD normalized phone
  shippingDistrict: string;   // Validated against BD Districts list
  shippingAddress: string;    // Street, flat, area (min 8 chars)
  paymentMethod: 'CASH_ON_DELIVERY' | 'BKASH' | 'NAGAD';
  idempotencyKey: string;     // Client-generated UUIDv4
  attribution: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    fbclid?: string;
    ttclid?: string;
    trafficSource: 'D2C_FUNNEL';
    landingPage: string;      // Full URL e.g. "https://lifestyle.splaro.co/drop/leather-wallet"
  };
}
```

### Bangladesh Phone Normalizer
Every submitted phone number must pass the strict Bangladeshi cellular carrier normalizer before submission:
```typescript
export function normalizeBdPhoneNumber(raw: string): { phone: string; isValid: boolean } {
  const digits = raw.replace(/\D/g, '');
  // Matches 013XXXXXXXX to 019XXXXXXXX
  let normalized = '';
  if (digits.startsWith('8801') && digits.length === 13) {
    normalized = '0' + digits.slice(3);
  } else if (digits.startsWith('01') && digits.length === 11) {
    normalized = digits;
  }
  const isValid = /^01[3-9]\d{8}$/.test(normalized);
  return { phone: normalized, isValid };
}
```

### Delivery Fee Matrix (Enforced Server-Side)
| Customer Location | Delivery Fee | Expected SLA |
| :--- | :--- | :--- |
| **Inside Dhaka City** | ৳70 | 24–48 Hours |
| **Outside Dhaka (All Districts)** | ৳130 | 48–72 Hours |

---

## 7. Single Central Admin Management (`apps/admin`)

### 1. Funnel Universe Hub (`/dashboard/funnels`)
- Visual cards displaying each active domain/subdomain universe.
- Card metrics: Active Drop, Theme Badge, Live Orders Count, Conversion Rate.
- Action: **`+ Launch New Domain Universe`** wizard.

### 2. Product Channel Assignment
- In `ProductCreatePanel`:
  - Toggle `Channel: [ SPLARO Fashion ] OR [ Funnel Drop: Domain ]`.
  - Dropdown allows selecting `lifestyle.splaro.co`, `ls.splaro.co`, `shop.splaro.co`, or any custom domain.
  - Funnel drop products NEVER query on `splaro.co`.

### 3. Orders Command Center (`/dashboard/funnels/orders`)
- Displays ONLY funnel orders.
- Quick Filter Tabs: `All Domains` | `lifestyle.splaro.co` | `ls.splaro.co` | `shop.splaro.co` | `custom.com`.
- Direct 1-Click Steadfast Courier dispatch.

### 4. Automated Telegram Notification Alert
```
⚡ NEW D2C FUNNEL ORDER!
━━━━━━━━━━━━━━━━━━━━
📦 Product: Midnight Chrono Watch
🔖 Invoice: SPL-8942
👤 Customer: Tanvir Ahmed
📞 Phone: 01712XXXXXX
📍 Address: House 12, Road 5, Dhanmondi, Dhaka
💵 Total: ৳3,450 (COD - Inside Dhaka ৳70)
🌐 Universe: lifestyle.splaro.co (Ad: SummerDrop_V1)
━━━━━━━━━━━━━━━━━━━━
🚀 Ready for Steadfast dispatch in Admin!
```

---

## 8. Developer & Deployment Cheat Sheet

```bash
# 1. Dev Stack Commands
pnpm dev:stack       # Runs web (:3000), admin (:3001), api (:4000)
pnpm dev:funnel      # Runs standalone funnel app (:3002)

# 2. Quality Verification Commands
pnpm check:admin     # Verify admin types & CSS
pnpm check:web       # Verify storefront
pnpm check:api       # Verify NestJS API compilation
pnpm --filter @splaro/api test:unit  # Run all 871+ backend unit tests

# 3. VPS Wildcard Nginx Configuration
server {
    server_name *.splaro.co;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
