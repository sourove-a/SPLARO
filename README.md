# SPLARO — Luxury Women's Fashion Platform

<div align="center">
  <img src="docs/assets/splaro-logo.png" alt="SPLARO Logo" width="200" />
  
  **The definitive luxury fashion eCommerce + SaaS platform for Bangladesh and international markets.**
  
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
  [![NestJS](https://img.shields.io/badge/NestJS-10-red?style=flat-square&logo=nestjs)](https://nestjs.com)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)](https://postgresql.org)
  [![Redis](https://img.shields.io/badge/Redis-7-red?style=flat-square&logo=redis)](https://redis.io)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
  [![License](https://img.shields.io/badge/License-Proprietary-gold?style=flat-square)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Design System](#design-system)
- [Database Schema](#database-schema)
- [API Modules](#api-modules)
- [Bangladesh eCommerce](#bangladesh-ecommerce)
- [Courier Automation](#courier-automation)
- [Invoice System](#invoice-system)
- [Print Automation](#print-automation)
- [Google Sheets Sync](#google-sheets-sync)
- [AI Features](#ai-features)
- [Admin Panel](#admin-panel)
- [SaaS Architecture](#saas-architecture)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [SEO Strategy](#seo-strategy)
- [Performance](#performance)
- [Contributing](#contributing)

---

## Overview

SPLARO is a world-class luxury women's fashion brand built for the Bangladesh market with international reach. This platform is engineered to the same standard as a $100,000+ custom agency build — combining the editorial luxury of Dior, the usability precision of Apple, and the conversion focus of leading fashion brands.

**Brand Positioning:** Luxury fashion house, not a typical eCommerce store.

**Visual Direction:** Fashion magazine + high-end boutique.

**Target Audience:** Women aged 18–45 in Bangladesh and international markets.

**Platform Type:** Full-stack eCommerce + SaaS-ready + Admin + AI + Automation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SPLARO PLATFORM                             │
├────────────────┬────────────────┬───────────────┬───────────────────┤
│   WEB (Next.js)│  ADMIN (Next.js)│  API (NestJS) │  WORKER (BullMQ) │
│   Port 3000    │   Port 3001    │   Port 4000   │   Background      │
├────────────────┴────────────────┴───────────────┴───────────────────┤
│                        SHARED PACKAGES                               │
│        @splaro/database  @splaro/ui  @splaro/types  @splaro/config  │
├─────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE                                 │
│  PostgreSQL 16 │ Redis 7 │ Cloudflare R2 │ BullMQ │ PM2 │ Nginx     │
├─────────────────────────────────────────────────────────────────────┤
│                      INTEGRATIONS                                    │
│  bKash │ Nagad │ SSLCommerz │ Steadfast │ Pathao │ RedX │ Paperfly  │
│  Google Sheets │ WhatsApp API │ SMS │ Email │ OpenAI │ Print API    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
SPLARO-BRAND/
│
├── README.md                          # This file
├── .env.example                       # Environment variable template
├── .env.local                         # Local dev environment (git-ignored)
├── .gitignore                         # Git ignore rules
├── .eslintrc.json                     # ESLint configuration
├── .prettierrc                        # Prettier configuration
├── .editorconfig                      # Editor configuration
├── package.json                       # Root monorepo package
├── pnpm-workspace.yaml                # PNPM workspace config
├── turbo.json                         # Turborepo pipeline config
├── tsconfig.base.json                 # Base TypeScript config
│
├── apps/
│   │
│   ├── web/                           # ★ MAIN STOREFRONT (Next.js 15)
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── postcss.config.js
│   │   ├── next-sitemap.config.js     # Auto sitemap generation
│   │   ├── public/
│   │   │   ├── fonts/                 # Self-hosted fonts (Cormorant, Inter)
│   │   │   │   ├── CormorantGaramond-Light.woff2
│   │   │   │   ├── CormorantGaramond-Regular.woff2
│   │   │   │   ├── CormorantGaramond-Medium.woff2
│   │   │   │   ├── CormorantGaramond-SemiBold.woff2
│   │   │   │   ├── Inter-Regular.woff2
│   │   │   │   ├── Inter-Medium.woff2
│   │   │   │   └── Inter-SemiBold.woff2
│   │   │   ├── images/
│   │   │   │   ├── logo/
│   │   │   │   │   ├── splaro-logo.svg
│   │   │   │   │   ├── splaro-logo-white.svg
│   │   │   │   │   └── splaro-logo-dark.svg
│   │   │   │   ├── hero/              # Hero section images
│   │   │   │   ├── collections/       # Collection category images
│   │   │   │   ├── banners/           # Campaign banners
│   │   │   │   └── placeholders/      # Blur placeholder images
│   │   │   ├── icons/
│   │   │   │   ├── favicon.ico
│   │   │   │   ├── favicon-32x32.png
│   │   │   │   ├── apple-touch-icon.png
│   │   │   │   └── site.webmanifest
│   │   │   ├── robots.txt
│   │   │   └── sitemap.xml            # Auto-generated
│   │   │
│   │   └── src/
│   │       ├── app/                   # Next.js 15 App Router
│   │       │   ├── layout.tsx         # Root layout (fonts, providers, SEO)
│   │       │   ├── page.tsx           # Homepage
│   │       │   ├── globals.css        # Global styles
│   │       │   ├── loading.tsx        # Root loading UI
│   │       │   ├── error.tsx          # Root error boundary
│   │       │   ├── not-found.tsx      # 404 page
│   │       │   │
│   │       │   ├── (shop)/            # Shop route group
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── products/
│   │       │   │   │   ├── page.tsx                    # All products
│   │       │   │   │   └── [slug]/
│   │       │   │   │       ├── page.tsx                # Product detail
│   │       │   │   │       ├── loading.tsx
│   │       │   │   │       └── opengraph-image.tsx     # Dynamic OG image
│   │       │   │   ├── collections/
│   │       │   │   │   ├── page.tsx                    # All collections
│   │       │   │   │   └── [slug]/
│   │       │   │   │       └── page.tsx                # Collection detail
│   │       │   │   ├── new-arrivals/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── best-sellers/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── sale/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── search/
│   │       │   │   │   └── page.tsx                    # Search results
│   │       │   │   ├── cart/
│   │       │   │   │   └── page.tsx                    # Cart page
│   │       │   │   └── checkout/
│   │       │   │       ├── page.tsx                    # Checkout
│   │       │   │       ├── success/
│   │       │   │       │   └── page.tsx                # Order success
│   │       │   │       └── failed/
│   │       │   │           └── page.tsx                # Payment failed
│   │       │   │
│   │       │   ├── (auth)/            # Auth route group
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── login/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── register/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── forgot-password/
│   │       │   │   │   └── page.tsx
│   │       │   │   └── reset-password/
│   │       │   │       └── page.tsx
│   │       │   │
│   │       │   ├── account/           # Customer account
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── page.tsx                        # Dashboard
│   │       │   │   ├── orders/
│   │       │   │   │   ├── page.tsx                    # Order history
│   │       │   │   │   └── [id]/
│   │       │   │   │       └── page.tsx                # Order detail
│   │       │   │   ├── wishlist/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── profile/
│   │       │   │   │   └── page.tsx
│   │       │   │   └── addresses/
│   │       │   │       └── page.tsx
│   │       │   │
│   │       │   ├── track-order/
│   │       │   │   └── page.tsx                        # Public order tracking
│   │       │   │
│   │       │   ├── about/
│   │       │   │   └── page.tsx
│   │       │   ├── contact/
│   │       │   │   └── page.tsx
│   │       │   ├── sustainability/
│   │       │   │   └── page.tsx
│   │       │   ├── careers/
│   │       │   │   └── page.tsx
│   │       │   ├── size-guide/
│   │       │   │   └── page.tsx
│   │       │   ├── store-locator/
│   │       │   │   └── page.tsx
│   │       │   ├── returns-exchange/
│   │       │   │   └── page.tsx
│   │       │   ├── delivery-information/
│   │       │   │   └── page.tsx
│   │       │   ├── faq/
│   │       │   │   └── page.tsx
│   │       │   ├── privacy-policy/
│   │       │   │   └── page.tsx
│   │       │   ├── terms-conditions/
│   │       │   │   └── page.tsx
│   │       │   │
│   │       │   └── api/               # Next.js API routes (webhooks)
│   │       │       ├── webhooks/
│   │       │       │   ├── bkash/
│   │       │       │   │   └── route.ts
│   │       │       │   ├── nagad/
│   │       │       │   │   └── route.ts
│   │       │       │   └── sslcommerz/
│   │       │       │       └── route.ts
│   │       │       └── og/
│   │       │           └── route.ts   # Dynamic OG image generation
│   │       │
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── Header/
│   │       │   │   │   ├── Header.tsx             # Liquid glass header
│   │       │   │   │   ├── TopBar.tsx             # Announcement bar
│   │       │   │   │   ├── Navigation.tsx         # Main nav
│   │       │   │   │   ├── MobileMenu.tsx         # Mobile drawer
│   │       │   │   │   ├── SearchModal.tsx        # Full-screen search
│   │       │   │   │   ├── CartDrawer.tsx         # Slide-in cart
│   │       │   │   │   ├── WishlistIcon.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── Footer/
│   │       │   │   │   ├── Footer.tsx             # Luxury dark footer
│   │       │   │   │   ├── FooterLinks.tsx
│   │       │   │   │   ├── Newsletter.tsx
│   │       │   │   │   ├── SocialLinks.tsx
│   │       │   │   │   ├── PaymentBadges.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── Providers.tsx              # All context providers
│   │       │   │   └── WhatsAppButton.tsx         # Floating WhatsApp CTA
│   │       │   │
│   │       │   ├── home/
│   │       │   │   ├── HeroSection/
│   │       │   │   │   ├── HeroSection.tsx        # Full-viewport hero
│   │       │   │   │   ├── HeroSlider.tsx         # Cinematic slider
│   │       │   │   │   └── index.ts
│   │       │   │   ├── TrustBar/
│   │       │   │   │   ├── TrustBar.tsx           # Icons trust section
│   │       │   │   │   └── index.ts
│   │       │   │   ├── CollectionsSection/
│   │       │   │   │   ├── CollectionsSection.tsx # Editorial category cards
│   │       │   │   │   ├── CollectionCard.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── NewArrivals/
│   │       │   │   │   ├── NewArrivals.tsx        # Product carousel
│   │       │   │   │   └── index.ts
│   │       │   │   ├── BestSellers/
│   │       │   │   │   ├── BestSellers.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── EditorialBanner/
│   │       │   │   │   ├── EditorialBanner.tsx    # Full-width campaign
│   │       │   │   │   └── index.ts
│   │       │   │   ├── WhySplaro/
│   │       │   │   │   ├── WhySplaro.tsx          # Brand story + USPs
│   │       │   │   │   └── index.ts
│   │       │   │   ├── SpecialOffer/
│   │       │   │   │   ├── SpecialOffer.tsx       # Black & gold promo card
│   │       │   │   │   └── index.ts
│   │       │   │   ├── Reviews/
│   │       │   │   │   ├── Reviews.tsx            # Customer testimonials
│   │       │   │   │   ├── ReviewCard.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   └── InstagramSection/
│   │       │   │       ├── InstagramSection.tsx   # Social gallery
│   │       │   │       └── index.ts
│   │       │   │
│   │       │   ├── product/
│   │       │   │   ├── ProductCard/
│   │       │   │   │   ├── ProductCard.tsx        # Luxury product card
│   │       │   │   │   ├── ProductCardSkeleton.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── ProductGrid/
│   │       │   │   │   ├── ProductGrid.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── ProductDetail/
│   │       │   │   │   ├── ProductDetail.tsx      # Full product page
│   │       │   │   │   ├── ProductImages.tsx      # Image gallery
│   │       │   │   │   ├── ProductInfo.tsx        # Name, price, desc
│   │       │   │   │   ├── ProductVariants.tsx    # Size & color picker
│   │       │   │   │   ├── ProductActions.tsx     # Add to cart / wishlist
│   │       │   │   │   ├── ProductTabs.tsx        # Details / care / reviews
│   │       │   │   │   ├── RelatedProducts.tsx
│   │       │   │   │   ├── SizeGuideModal.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── ProductFilters/
│   │       │   │   │   ├── ProductFilters.tsx
│   │       │   │   │   ├── FilterSidebar.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── ColorSwatch/
│   │       │   │   │   ├── ColorSwatch.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   └── QuickView/
│   │       │   │       ├── QuickViewModal.tsx
│   │       │   │       └── index.ts
│   │       │   │
│   │       │   ├── cart/
│   │       │   │   ├── CartItem.tsx
│   │       │   │   ├── CartSummary.tsx
│   │       │   │   ├── CartEmpty.tsx
│   │       │   │   └── CouponInput.tsx
│   │       │   │
│   │       │   ├── checkout/
│   │       │   │   ├── CheckoutForm.tsx           # Address + payment form
│   │       │   │   ├── DeliveryOptions.tsx        # Dhaka / outside Dhaka
│   │       │   │   ├── PaymentMethods.tsx         # bKash, Nagad, COD, SSL
│   │       │   │   ├── OrderSummary.tsx
│   │       │   │   ├── BkashPayment.tsx           # bKash payment flow
│   │       │   │   ├── NagadPayment.tsx
│   │       │   │   └── OrderConfirmation.tsx
│   │       │   │
│   │       │   └── ui/                            # Reusable UI primitives
│   │       │       ├── Button/
│   │       │       │   ├── Button.tsx             # Luxury button variants
│   │       │       │   └── index.ts
│   │       │       ├── Input/
│   │       │       │   ├── Input.tsx
│   │       │       │   └── index.ts
│   │       │       ├── Modal/
│   │       │       │   ├── Modal.tsx
│   │       │       │   └── index.ts
│   │       │       ├── Drawer/
│   │       │       │   ├── Drawer.tsx
│   │       │       │   └── index.ts
│   │       │       ├── Badge/
│   │       │       │   └── Badge.tsx
│   │       │       ├── Skeleton/
│   │       │       │   └── Skeleton.tsx
│   │       │       ├── Toast/
│   │       │       │   └── Toast.tsx
│   │       │       ├── Breadcrumb/
│   │       │       │   └── Breadcrumb.tsx
│   │       │       ├── Pagination/
│   │       │       │   └── Pagination.tsx
│   │       │       ├── Select/
│   │       │       │   └── Select.tsx
│   │       │       ├── Checkbox/
│   │       │       │   └── Checkbox.tsx
│   │       │       ├── Radio/
│   │       │       │   └── Radio.tsx
│   │       │       ├── Accordion/
│   │       │       │   └── Accordion.tsx
│   │       │       ├── Tabs/
│   │       │       │   └── Tabs.tsx
│   │       │       ├── StarRating/
│   │       │       │   └── StarRating.tsx
│   │       │       ├── ImageZoom/
│   │       │       │   └── ImageZoom.tsx
│   │       │       └── LuxuryDivider/
│   │       │           └── LuxuryDivider.tsx      # Gold ornamental divider
│   │       │
│   │       ├── lib/
│   │       │   ├── api/
│   │       │   │   ├── client.ts                  # Axios/fetch API client
│   │       │   │   ├── products.ts                # Product API calls
│   │       │   │   ├── orders.ts                  # Order API calls
│   │       │   │   ├── auth.ts                    # Auth API calls
│   │       │   │   ├── cart.ts                    # Cart operations
│   │       │   │   ├── wishlist.ts
│   │       │   │   └── reviews.ts
│   │       │   ├── utils/
│   │       │   │   ├── currency.ts                # BDT formatting
│   │       │   │   ├── seo.ts                     # SEO helpers
│   │       │   │   ├── image.ts                   # Image optimization
│   │       │   │   ├── validators.ts              # Form validators (BD phone)
│   │       │   │   ├── date.ts                    # Date formatting
│   │       │   │   └── cn.ts                      # Class name merger
│   │       │   ├── hooks/
│   │       │   │   ├── useCart.ts
│   │       │   │   ├── useWishlist.ts
│   │       │   │   ├── useProducts.ts
│   │       │   │   ├── useAuth.ts
│   │       │   │   ├── useSearch.ts
│   │       │   │   ├── useLocalStorage.ts
│   │       │   │   └── useIntersectionObserver.ts
│   │       │   └── constants/
│   │       │       ├── navigation.ts
│   │       │       ├── delivery.ts                # Delivery zone config
│   │       │       └── seo.ts                     # Default SEO values
│   │       │
│   │       ├── store/
│   │       │   ├── index.ts                       # Zustand store
│   │       │   ├── cartStore.ts
│   │       │   ├── wishlistStore.ts
│   │       │   ├── authStore.ts
│   │       │   └── uiStore.ts
│   │       │
│   │       └── types/
│   │           ├── product.ts
│   │           ├── order.ts
│   │           ├── user.ts
│   │           ├── cart.ts
│   │           ├── payment.ts
│   │           └── api.ts
│   │
│   ├── admin/                         # ★ ADMIN DASHBOARD (Next.js 15)
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx                       # Admin login
│   │       │   └── dashboard/
│   │       │       ├── layout.tsx                 # Sidebar layout
│   │       │       ├── page.tsx                   # Overview dashboard
│   │       │       ├── products/
│   │       │       │   ├── page.tsx               # Product list
│   │       │       │   ├── new/
│   │       │       │   │   └── page.tsx           # Create product
│   │       │       │   └── [id]/
│   │       │       │       └── page.tsx           # Edit product
│   │       │       ├── orders/
│   │       │       │   ├── page.tsx               # Order list + filters
│   │       │       │   └── [id]/
│   │       │       │       └── page.tsx           # Order detail + actions
│   │       │       ├── customers/
│   │       │       │   ├── page.tsx
│   │       │       │   └── [id]/
│   │       │       │       └── page.tsx
│   │       │       ├── collections/
│   │       │       │   └── page.tsx
│   │       │       ├── categories/
│   │       │       │   └── page.tsx
│   │       │       ├── inventory/
│   │       │       │   └── page.tsx               # Stock management
│   │       │       ├── coupons/
│   │       │       │   └── page.tsx
│   │       │       ├── banners/
│   │       │       │   └── page.tsx               # Banner / hero management
│   │       │       ├── reviews/
│   │       │       │   └── page.tsx               # Review moderation
│   │       │       ├── courier/
│   │       │       │   ├── page.tsx               # Courier bookings
│   │       │       │   └── failed/
│   │       │       │       └── page.tsx           # Failed bookings retry
│   │       │       ├── invoices/
│   │       │       │   ├── page.tsx               # Invoice list
│   │       │       │   └── [id]/
│   │       │       │       └── page.tsx           # Invoice view + print
│   │       │       ├── print-queue/
│   │       │       │   └── page.tsx               # Print queue dashboard
│   │       │       ├── google-sheets/
│   │       │       │   └── page.tsx               # Sheets sync status
│   │       │       ├── analytics/
│   │       │       │   ├── page.tsx               # Sales analytics
│   │       │       │   ├── products/
│   │       │       │   │   └── page.tsx
│   │       │       │   └── customers/
│   │       │       │       └── page.tsx
│   │       │       ├── ai/
│   │       │       │   ├── page.tsx               # AI tools hub
│   │       │       │   ├── product-writer/
│   │       │       │   │   └── page.tsx           # AI product desc
│   │       │       │   ├── seo-writer/
│   │       │       │   │   └── page.tsx           # AI SEO meta
│   │       │       │   └── insights/
│   │       │       │       └── page.tsx           # AI sales insights
│   │       │       ├── staff/
│   │       │       │   └── page.tsx               # Staff + roles
│   │       │       └── settings/
│   │       │           ├── page.tsx               # General settings
│   │       │           ├── payments/
│   │       │           │   └── page.tsx
│   │       │           ├── shipping/
│   │       │           │   └── page.tsx
│   │       │           └── seo/
│   │       │               └── page.tsx
│   │       └── components/
│   │           ├── layout/
│   │           │   ├── AdminSidebar.tsx
│   │           │   ├── AdminHeader.tsx
│   │           │   └── AdminBreadcrumb.tsx
│   │           ├── orders/
│   │           │   ├── OrderTable.tsx
│   │           │   ├── OrderStatusBadge.tsx
│   │           │   ├── CourierBookingBtn.tsx
│   │           │   └── PrintInvoiceBtn.tsx
│   │           ├── products/
│   │           │   ├── ProductForm.tsx
│   │           │   ├── VariantManager.tsx
│   │           │   ├── ImageUploader.tsx
│   │           │   └── AIDescriptionWriter.tsx
│   │           ├── analytics/
│   │           │   ├── SalesChart.tsx
│   │           │   ├── RevenueCard.tsx
│   │           │   └── TopProducts.tsx
│   │           └── ui/
│   │               ├── DataTable.tsx
│   │               ├── StatCard.tsx
│   │               └── PageHeader.tsx
│   │
│   └── api/                           # ★ BACKEND API (NestJS)
│       ├── package.json
│       ├── tsconfig.json
│       ├── nest-cli.json
│       └── src/
│           ├── main.ts                # Bootstrap + Swagger
│           ├── app.module.ts          # Root module
│           │
│           ├── modules/
│           │   ├── auth/
│           │   │   ├── auth.module.ts
│           │   │   ├── auth.controller.ts
│           │   │   ├── auth.service.ts
│           │   │   ├── strategies/
│           │   │   │   ├── jwt.strategy.ts
│           │   │   │   ├── local.strategy.ts
│           │   │   │   └── refresh.strategy.ts
│           │   │   └── dto/
│           │   │       ├── login.dto.ts
│           │   │       └── register.dto.ts
│           │   │
│           │   ├── products/
│           │   │   ├── products.module.ts
│           │   │   ├── products.controller.ts
│           │   │   ├── products.service.ts
│           │   │   ├── variants.service.ts
│           │   │   └── dto/
│           │   │       ├── create-product.dto.ts
│           │   │       └── update-product.dto.ts
│           │   │
│           │   ├── categories/
│           │   │   ├── categories.module.ts
│           │   │   ├── categories.controller.ts
│           │   │   └── categories.service.ts
│           │   │
│           │   ├── collections/
│           │   │   ├── collections.module.ts
│           │   │   ├── collections.controller.ts
│           │   │   └── collections.service.ts
│           │   │
│           │   ├── orders/
│           │   │   ├── orders.module.ts
│           │   │   ├── orders.controller.ts
│           │   │   ├── orders.service.ts          # Core order logic
│           │   │   ├── order-status.service.ts    # Status flow management
│           │   │   └── dto/
│           │   │       ├── create-order.dto.ts
│           │   │       └── update-order.dto.ts
│           │   │
│           │   ├── checkout/
│           │   │   ├── checkout.module.ts
│           │   │   ├── checkout.controller.ts
│           │   │   └── checkout.service.ts        # Full checkout pipeline
│           │   │
│           │   ├── payments/
│           │   │   ├── payments.module.ts
│           │   │   ├── payments.controller.ts
│           │   │   ├── payments.service.ts
│           │   │   ├── providers/
│           │   │   │   ├── bkash.service.ts       # bKash payment API
│           │   │   │   ├── nagad.service.ts       # Nagad payment API
│           │   │   │   └── sslcommerz.service.ts  # SSLCommerz payment
│           │   │   └── dto/
│           │   │       └── payment.dto.ts
│           │   │
│           │   ├── courier/
│           │   │   ├── courier.module.ts
│           │   │   ├── courier.controller.ts
│           │   │   ├── courier.service.ts         # Courier orchestrator
│           │   │   ├── providers/
│           │   │   │   ├── steadfast.service.ts   # Steadfast Courier API
│           │   │   │   ├── pathao.service.ts      # Pathao Courier API
│           │   │   │   ├── redx.service.ts        # RedX Courier API
│           │   │   │   └── paperfly.service.ts    # Paperfly Courier API
│           │   │   ├── courier.processor.ts       # BullMQ job processor
│           │   │   └── dto/
│           │   │       └── courier-booking.dto.ts
│           │   │
│           │   ├── invoices/
│           │   │   ├── invoices.module.ts
│           │   │   ├── invoices.controller.ts
│           │   │   ├── invoices.service.ts        # Invoice generation
│           │   │   ├── invoice.template.ts        # HTML invoice template
│           │   │   ├── invoice-pdf.service.ts     # PDF generation (Puppeteer)
│           │   │   └── dto/
│           │   │       └── invoice.dto.ts
│           │   │
│           │   ├── print/
│           │   │   ├── print.module.ts
│           │   │   ├── print.controller.ts
│           │   │   ├── print.service.ts           # Print queue manager
│           │   │   ├── print.processor.ts         # BullMQ print processor
│           │   │   ├── printers/
│           │   │   │   ├── thermal-printer.service.ts  # 80mm thermal receipt
│           │   │   │   ├── network-printer.service.ts  # Network printer
│           │   │   │   └── pdf-printer.service.ts      # PDF virtual printer
│           │   │   └── templates/
│           │   │       ├── receipt.template.ts    # Thermal receipt template
│           │   │       ├── invoice.template.ts    # A4 invoice template
│           │   │       └── label.template.ts      # Shipping label template
│           │   │
│           │   ├── google-sheets/
│           │   │   ├── google-sheets.module.ts
│           │   │   ├── google-sheets.controller.ts
│           │   │   ├── google-sheets.service.ts   # Google Sheets API sync
│           │   │   ├── google-sheets.processor.ts # BullMQ sync processor
│           │   │   └── sheets/
│           │   │       ├── orders-sheet.ts        # Orders → Sheets sync
│           │   │       ├── inventory-sheet.ts     # Inventory → Sheets
│           │   │       ├── customers-sheet.ts     # Customers → Sheets
│           │   │       └── revenue-sheet.ts       # Revenue → Sheets
│           │   │
│           │   ├── customers/
│           │   │   ├── customers.module.ts
│           │   │   ├── customers.controller.ts
│           │   │   └── customers.service.ts
│           │   │
│           │   ├── inventory/
│           │   │   ├── inventory.module.ts
│           │   │   ├── inventory.controller.ts
│           │   │   └── inventory.service.ts       # Stock management
│           │   │
│           │   ├── coupons/
│           │   │   ├── coupons.module.ts
│           │   │   ├── coupons.controller.ts
│           │   │   └── coupons.service.ts
│           │   │
│           │   ├── reviews/
│           │   │   ├── reviews.module.ts
│           │   │   ├── reviews.controller.ts
│           │   │   └── reviews.service.ts
│           │   │
│           │   ├── notifications/
│           │   │   ├── notifications.module.ts
│           │   │   ├── notifications.service.ts   # Notification dispatcher
│           │   │   ├── channels/
│           │   │   │   ├── sms.service.ts         # SMS (SSL Wireless/bD sms)
│           │   │   │   ├── email.service.ts       # Email (Nodemailer/SES)
│           │   │   │   └── whatsapp.service.ts    # WhatsApp Business API
│           │   │   └── templates/
│           │   │       ├── order-confirmed.ts
│           │   │       ├── order-shipped.ts
│           │   │       ├── order-delivered.ts
│           │   │       └── abandoned-cart.ts
│           │   │
│           │   ├── ai/
│           │   │   ├── ai.module.ts
│           │   │   ├── ai.controller.ts
│           │   │   ├── ai.service.ts              # OpenAI orchestrator
│           │   │   ├── agents/
│           │   │   │   ├── product-writer.agent.ts     # Product descriptions
│           │   │   │   ├── seo-writer.agent.ts         # SEO meta generation
│           │   │   │   ├── chatbot.agent.ts            # Customer support bot
│           │   │   │   ├── abandoned-cart.agent.ts     # Recovery messages
│           │   │   │   ├── sales-insights.agent.ts     # Revenue insights
│           │   │   │   ├── stock-prediction.agent.ts   # Inventory prediction
│           │   │   │   ├── fraud-detection.agent.ts    # COD risk scoring
│           │   │   │   └── recommendation.agent.ts     # Product recs
│           │   │   └── dto/
│           │   │       └── ai-job.dto.ts
│           │   │
│           │   ├── analytics/
│           │   │   ├── analytics.module.ts
│           │   │   ├── analytics.controller.ts
│           │   │   └── analytics.service.ts       # Sales, traffic, revenue
│           │   │
│           │   ├── uploads/
│           │   │   ├── uploads.module.ts
│           │   │   ├── uploads.controller.ts
│           │   │   └── r2-storage.service.ts      # Cloudflare R2 / S3
│           │   │
│           │   └── admin/
│           │       ├── admin.module.ts
│           │       ├── admin.controller.ts
│           │       └── admin.service.ts
│           │
│           └── common/
│               ├── guards/
│               │   ├── jwt-auth.guard.ts
│               │   ├── roles.guard.ts
│               │   └── store.guard.ts
│               ├── decorators/
│               │   ├── roles.decorator.ts
│               │   ├── current-user.decorator.ts
│               │   └── public.decorator.ts
│               ├── interceptors/
│               │   ├── transform.interceptor.ts   # API response wrapping
│               │   ├── logging.interceptor.ts
│               │   └── timeout.interceptor.ts
│               ├── filters/
│               │   └── http-exception.filter.ts
│               ├── pipes/
│               │   └── validation.pipe.ts
│               └── config/
│                   ├── database.config.ts
│                   ├── redis.config.ts
│                   ├── jwt.config.ts
│                   └── storage.config.ts
│
├── packages/
│   ├── database/                      # ★ PRISMA DATABASE PACKAGE
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Full database schema (25+ models)
│   │   │   ├── seed.ts                # Database seeder
│   │   │   └── migrations/            # Auto-generated migrations
│   │   └── src/
│   │       ├── index.ts               # Prisma client export
│   │       └── client.ts              # Singleton client
│   │
│   ├── ui/                            # ★ SHARED UI COMPONENTS
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── tokens/
│   │           ├── colors.ts          # Design token colors
│   │           ├── typography.ts      # Font scales
│   │           └── spacing.ts        # Spacing scale
│   │
│   ├── types/                         # ★ SHARED TYPESCRIPT TYPES
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── product.types.ts
│   │       ├── order.types.ts
│   │       ├── user.types.ts
│   │       ├── payment.types.ts
│   │       ├── courier.types.ts
│   │       ├── invoice.types.ts
│   │       └── api.types.ts
│   │
│   └── config/                        # ★ SHARED CONFIGURATION
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── delivery-zones.ts      # Bangladesh delivery zones + charges
│           ├── payment-gateways.ts    # Payment gateway configs
│           └── courier-providers.ts   # Courier API configs
│
├── infrastructure/
│   ├── nginx/
│   │   ├── nginx.conf                 # Main Nginx config
│   │   ├── splaro-web.conf            # Storefront proxy
│   │   ├── splaro-admin.conf          # Admin proxy
│   │   ├── splaro-api.conf            # API proxy
│   │   └── ssl.conf                   # SSL/TLS configuration
│   │
│   ├── pm2/
│   │   ├── ecosystem.config.js        # PM2 process manager config
│   │   └── logs/                      # PM2 log directory
│   │
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   ├── docker-compose.yml         # Full stack docker compose
│   │   └── docker-compose.dev.yml     # Dev environment
│   │
│   └── scripts/
│       ├── deploy.sh                  # Production deployment script
│       ├── backup-db.sh               # PostgreSQL backup script
│       ├── restore-db.sh              # Database restore script
│       ├── setup-server.sh            # Fresh server setup (Hostinger VPS)
│       └── ssl-renew.sh               # Let's Encrypt renewal
│
├── tools/
│   ├── invoice-generator/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts               # Invoice generator entry
│   │   │   ├── templates/
│   │   │   │   ├── invoice-a4.html    # A4 invoice template
│   │   │   │   ├── receipt-80mm.html  # 80mm thermal receipt
│   │   │   │   └── shipping-label.html # Shipping label
│   │   │   └── assets/
│   │   │       ├── invoice.css        # Invoice styles
│   │   │       └── splaro-logo.png
│   │   └── dist/                      # Compiled templates
│   │
│   ├── print-service/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts               # Print service daemon
│   │   │   ├── printer-discovery.ts   # Auto-discover network printers
│   │   │   ├── print-queue.ts         # Redis-backed print queue
│   │   │   └── drivers/
│   │   │       ├── thermal.ts         # ESC/POS thermal printer driver
│   │   │       ├── network.ts         # IPP network printer driver
│   │   │       └── pdf.ts             # PDF generation
│   │   └── config/
│   │       └── printers.json          # Printer configuration
│   │
│   └── google-sheets-sync/
│       ├── package.json
│       ├── src/
│       │   ├── index.ts               # Sheets sync entry
│       │   ├── auth.ts                # Google OAuth2 setup
│       │   ├── sync-orders.ts         # Sync orders to Sheets
│       │   ├── sync-inventory.ts      # Sync inventory to Sheets
│       │   └── sync-customers.ts      # Sync customers to Sheets
│       └── credentials/
│           └── .gitkeep               # Google service account JSON goes here
│
└── docs/
    ├── API.md                         # Full REST API documentation
    ├── DEPLOYMENT.md                  # Step-by-step Hostinger deployment
    ├── COURIER-SETUP.md               # Courier API integration guide
    ├── PAYMENT-SETUP.md               # Payment gateway setup
    ├── PRINT-SETUP.md                 # Printer configuration guide
    ├── GOOGLE-SHEETS-SETUP.md         # Google Sheets sync setup
    ├── AI-FEATURES.md                 # AI features documentation
    ├── CONTRIBUTING.md                # Contribution guidelines
    └── assets/
        └── splaro-logo.png
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 (App Router) | Storefront + SSR/SSG |
| **Admin** | Next.js 15 | Admin dashboard |
| **Styling** | Tailwind CSS 3.x | Utility-first CSS |
| **Animation** | Framer Motion 11 | Luxury micro-interactions |
| **Backend** | NestJS 10 | REST API server |
| **Language** | TypeScript 5.x | Full type safety |
| **Database** | PostgreSQL 16 | Primary data store |
| **ORM** | Prisma 5 | Type-safe DB access |
| **Cache** | Redis 7 | Session, cart, rate limit |
| **Queue** | BullMQ | Async job processing |
| **Auth** | JWT + Refresh tokens | Stateless authentication |
| **Storage** | Cloudflare R2 | Image / file storage |
| **State** | Zustand | Client-side state |
| **Monorepo** | Turborepo + PNPM | Workspace management |
| **PDF** | Puppeteer + html-pdf | Invoice generation |
| **Print** | node-thermal-printer | ESC/POS thermal printing |
| **AI** | OpenAI GPT-4o | AI feature layer |
| **Monitoring** | PM2 | Process management |
| **Reverse Proxy** | Nginx | Load balancing + SSL |
| **Deployment** | Hostinger VPS | Production hosting |

---

## Features

### Customer-Facing

- Full luxury editorial homepage with cinematic hero slider
- Collection browsing (Luxury Pret, Festive Edit, Sarees, Unstitched, Accessories)
- Product detail with image zoom, size guide, color swatches
- Quick view modal
- Smart search with instant results
- Wishlist (persistent, synced with account)
- Cart with real-time stock check
- Guest checkout + account checkout
- WhatsApp live chat integration
- Order tracking (public, no login required)
- Customer account portal
- Loyalty points (future)

### Bangladesh eCommerce

- Cash on Delivery (COD) — primary payment method
- bKash payment integration (create payment → execute → verify)
- Nagad payment integration
- SSLCommerz payment gateway (card, net banking)
- Inside Dhaka: ৳60 delivery / Outside Dhaka: ৳120 delivery
- Same-day dispatch for orders before 2PM
- SMS order confirmation (Bangladesh phone format validation)
- WhatsApp order notification
- Division-level delivery time estimates
- Promo code / coupon system
- Bulk discount support

### Courier Automation

- Auto-booking to Steadfast / Pathao / RedX / Paperfly on order confirm
- Courier selection logic (fastest, cheapest, zone-based)
- Consignment ID saved to order
- Customer tracking link generated instantly
- Failed booking retry queue (BullMQ)
- Admin manual retry + courier switch

### Invoice System

- Auto-generated invoice on every order
- A4 luxury PDF invoice (Puppeteer)
- 80mm thermal receipt format
- Invoice number format: `SPL-2026-00001`
- Tax breakdown (if applicable)
- Bulk invoice download (ZIP)
- Email invoice to customer

### Print Automation

- Auto-print invoice on order confirm (configurable)
- Auto-print shipping label for courier booking
- 80mm thermal receipt printer support (ESC/POS)
- Network printer support (IPP protocol)
- Print queue with retry logic
- Admin print dashboard — see all pending/completed prints
- Manual reprint from admin order detail

### Google Sheets Integration

- Real-time order sync to Google Sheets
- Daily inventory export
- Customer database export
- Revenue summary sheet (daily/weekly/monthly)
- BullMQ-powered async sync queue
- Manual sync trigger from admin panel
- Sheet column mapping fully configurable

### AI Features

- AI product description generator (OpenAI GPT-4o)
- AI SEO title + meta description generator
- AI customer support chatbot (on-site)
- AI abandoned cart recovery messages
- AI sales insights report (daily/weekly)
- AI low-stock prediction
- AI COD fraud/risk scoring
- AI product recommendations (personalized)

### Admin Panel

- Overview dashboard with key metrics
- Product CRUD with image management
- Variant system (size × color combinations)
- Inventory tracking + low stock alerts
- Order management with status workflow
- Courier booking management
- Customer management
- Coupon / promo code system
- Banner / hero slide management
- Review moderation
- Invoice list + download + reprint
- Print queue monitor
- Google Sheets sync status
- Sales analytics + charts
- AI tools hub
- Staff management + role permissions
- Store settings + payment settings + SEO settings

### SaaS Architecture (roadmap)

SPLARO production today is a **single store** (`splaro.co`). The schema can hold multiple stores, and the admin has a SaaS module shell for future expansion — not a full multi-tenant vendor platform.

**Implemented (API / admin shell):**
- Subscription and plan overview (`apps/api/src/modules/saas/`)
- Store list and loyalty-tier scaffolding

**Not implemented (README must not imply these exist):**
- Vendor dashboard, vendor product management, commission calculation, vendor payout reports
- Store-owner sub-dashboard
- Custom domain per store

Keep `FEATURE_SAAS_ENABLED=false`, `FEATURE_VENDOR_ENABLED=false`, and `FEATURE_LOYALTY_ENABLED=false` until those products ship. Flags are enforced in code (`packages/config` → API `@RequireFeature` + admin nav/UI via `GET /api/v1/features`) — not docs-only.

---

## Design System

### Color Tokens

```css
--color-bg-primary:     #FAF8F5;  /* Luxury Ivory */
--color-text-primary:   #111111;  /* Rich Black */
--color-text-secondary: #6B6B6B;  /* Warm Gray */
--color-accent-gold:    #C8A97E;  /* Signature Gold */
--color-border:         rgba(17,17,17,0.08);
--color-glass:          rgba(255,255,255,0.72);
--color-surface:        #FFFFFF;
--color-surface-alt:    #F5F3F0;
--color-dark-bg:        #111111;  /* Footer dark */
--color-dark-surface:   #1A1A1A;
```

### Typography

```
Headings:  Cormorant Garamond (Luxury Serif)
Body:      Inter (Clean Sans-Serif)

Scale:
  --text-xs:   0.75rem
  --text-sm:   0.875rem
  --text-base: 1rem
  --text-lg:   1.125rem
  --text-xl:   1.25rem
  --text-2xl:  1.5rem
  --text-3xl:  1.875rem
  --text-4xl:  2.25rem
  --text-5xl:  3rem
  --text-6xl:  3.75rem
  --text-7xl:  4.5rem
  --text-8xl:  6rem   ← Hero editorial headlines
```

---

## Database Schema

Full Prisma schema includes 25+ models:

| Model | Purpose |
|-------|---------|
| `User` | Customers + admin staff |
| `Role` | Permission roles (admin, staff, vendor) |
| `Store` | Multi-store SaaS tenants |
| `Product` | Product catalog |
| `ProductVariant` | Size/color combinations |
| `ProductImage` | Product gallery images |
| `Category` | Product categories |
| `Collection` | Curated product collections |
| `Order` | Customer orders |
| `OrderItem` | Line items within orders |
| `Customer` | Customer profiles + address book |
| `Address` | Saved shipping addresses |
| `Payment` | Payment records |
| `CourierShipment` | Courier booking records |
| `Coupon` | Discount codes |
| `Review` | Product reviews |
| `Wishlist` | Customer wishlists |
| `CartSession` | Guest cart persistence |
| `Invoice` | Invoice records + PDF path |
| `PrintJob` | Print queue jobs |
| `GoogleSheetSync` | Sync logs |
| `InventoryLog` | Stock movement history |
| `Notification` | Notification history |
| `AIJob` | AI processing jobs |
| `Subscription` | SaaS subscription plans |
| `Vendor` | Marketplace vendors |
| `AuditLog` | Admin action audit trail |
| `SiteSettings` | Global configuration |
| `Banner` | Hero/promotional banners |
| `StaffRole` | Staff permission assignments |

---

## API Modules

Full REST API at `/api/v1`:

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/auth` | Login, register, refresh, logout |
| Products | `/products` | CRUD, search, filter |
| Categories | `/categories` | Category tree |
| Collections | `/collections` | Curated collections |
| Orders | `/orders` | Order lifecycle |
| Checkout | `/checkout` | Full checkout pipeline |
| Payments | `/payments` | Payment processing |
| Courier | `/courier` | Courier booking + tracking |
| Customers | `/customers` | Customer management |
| Invoices | `/invoices` | Invoice generation + PDF |
| Print | `/print` | Print queue management |
| Google Sheets | `/sheets` | Sync management |
| Inventory | `/inventory` | Stock management |
| Coupons | `/coupons` | Promo code validation |
| Reviews | `/reviews` | Review submission |
| Uploads | `/uploads` | Image + file upload |
| AI | `/ai` | AI features |
| Analytics | `/analytics` | Sales + traffic data |
| Admin | `/admin` | Admin-only operations |
| Notifications | `/notifications` | Push notifications |
| Settings | `/settings` | Site configuration |

---

## Bangladesh eCommerce

### Delivery Zones

```
Inside Dhaka City:
  - Standard: ৳60 (1-2 business days)
  - Same-day: ৳100 (order before 2PM)

Outside Dhaka:
  - Standard: ৳120 (3-5 business days)
  - Express: ৳180 (2-3 business days)

Free delivery: On orders above ৳3,000
```

### Payment Methods

| Gateway | Type | Status |
|---------|------|--------|
| Cash on Delivery | COD | ✅ Primary |
| bKash | Mobile Banking | ✅ Live |
| Nagad | Mobile Banking | ✅ Live |
| SSLCommerz | Card/Net Banking | ✅ Live |
| bKash Merchant | Business API | ✅ |

### Phone Validation

Supports all Bangladesh mobile operators:
- Grameenphone (017x, 013x)
- Robi (018x)
- Banglalink (019x, 014x)
- Teletalk (015x)
- Airtel (016x)

---

## Courier Automation

### Auto-Booking Flow

```
Order Placed
     ↓
Order Validated (name, phone, address, city, product, qty)
     ↓
Invoice Number Generated: SPL-2026-XXXXX
     ↓
Stock Reduced
     ↓
SMS/Email/WhatsApp Confirmation Sent
     ↓
Courier API Called (Steadfast/Pathao/RedX/Paperfly)
     ↓
Consignment ID Saved
     ↓
Order Status → "Courier Booked"
     ↓
Tracking Link Generated
     ↓
[If Courier API Fails]
     → Added to BullMQ Retry Queue
     → Admin Notification Sent
     → Manual Retry Available
```

### Courier Priority Logic

```typescript
// Default courier selection priority:
// 1. Steadfast (Inside Dhaka — fastest)
// 2. Pathao Courier (Dhaka metro)
// 3. RedX (National — remote areas)
// 4. Paperfly (National backup)
// Admin can override per-order or set global default
```

### Order Status Flow

```
Pending → Confirmed → Processing → Courier Booked
→ Picked Up → In Transit → Out for Delivery
→ Delivered ✅
     or
→ Returned 🔄
     or
→ Cancelled ❌
```

---

## Invoice System

### Invoice Format

```
┌─────────────────────────────────────────┐
│           SPLARO                        │
│    Luxury Women's Fashion               │
│─────────────────────────────────────────│
│  INVOICE #: SPL-2026-00001              │
│  Date: 21 June 2026                     │
│  Order Date: 21 June 2026               │
│─────────────────────────────────────────│
│  BILL TO:                               │
│  Sanjida Islam                          │
│  Road 5, Dhanmondi, Dhaka 1205          │
│  +880 1712-345678                       │
│─────────────────────────────────────────│
│  ITEMS:                                 │
│  1x Embroidered Lawn Set (M, Ivory)     │
│                              ৳4,950     │
│─────────────────────────────────────────│
│  Subtotal:             ৳4,950           │
│  Delivery (Dhaka):        ৳60           │
│  Discount (SPLARO10):    -৳495          │
│  TOTAL:                ৳4,515           │
│─────────────────────────────────────────│
│  Payment: Cash on Delivery              │
│  Courier: Steadfast #SFD123456          │
│─────────────────────────────────────────│
│  Thank you for shopping with SPLARO     │
└─────────────────────────────────────────┘
```

### Invoice Templates

- **A4 PDF** — Luxury branded invoice (Puppeteer)
- **80mm Thermal** — ESC/POS receipt for thermal printers
- **Shipping Label** — Barcode + address label for courier

---

## Print Automation

### Supported Printers

| Printer Type | Protocol | Use Case |
|-------------|---------|---------|
| Thermal 80mm | ESC/POS (USB/Serial/BT) | Receipts, labels |
| Network Printer | IPP / LPD | A4 invoices |
| PDF Virtual | System | Digital archive |

### Setup

```bash
# Install print service
cd tools/print-service
pnpm install

# Configure your printer
nano config/printers.json

# Start print daemon
pnpm start
```

### Auto-Print Triggers

Configurable in Admin → Settings → Print:
- ✅ Auto-print invoice on order confirm
- ✅ Auto-print shipping label on courier booking
- ✅ Auto-print receipt on COD delivery
- ✅ Auto-print low-stock report daily at 9AM

---

## Google Sheets Integration

### Sheets Structure

**Sheet 1: Orders**
```
A: Order ID | B: Date | C: Customer | D: Phone | E: City |
F: Products | G: Total | H: Payment | I: Status | J: Courier ID
```

**Sheet 2: Inventory**
```
A: SKU | B: Product Name | C: Size | D: Color | E: Stock | F: Reserved
```

**Sheet 3: Customers**
```
A: ID | B: Name | C: Phone | D: Email | E: City | F: Orders | G: LTV
```

**Sheet 4: Daily Revenue**
```
A: Date | B: Orders | C: Revenue | D: COD | E: bKash | F: Nagad | G: Card
```

### Setup

```bash
# 1. Create Google Cloud project
# 2. Enable Google Sheets API
# 3. Create Service Account
# 4. Download credentials JSON → tools/google-sheets-sync/credentials/
# 5. Share your Sheets with the service account email

cd tools/google-sheets-sync
pnpm install
pnpm sync:all  # Initial full sync
```

---

## AI Features

| Feature | Model | Trigger |
|---------|-------|---------|
| Product Description | GPT-4o | Manual (admin) |
| SEO Meta | GPT-4o | Manual (admin) |
| Customer Chatbot | GPT-4o-mini | On-site widget |
| Abandoned Cart | GPT-4o-mini | 2h after cart abandon |
| Sales Insights | GPT-4o | Daily 7AM cron |
| Stock Prediction | GPT-4o | Weekly Sunday |
| Fraud Detection | GPT-4o-mini | Every COD order |
| Recommendations | GPT-4o-mini | Product page view |

---

## Installation

### Prerequisites

- Node.js >= 20.x
- PNPM >= 9.x
- PostgreSQL >= 16
- Redis >= 7
- Git

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/splaro/splaro-brand.git
cd splaro-brand

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Set up database
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed initial data

# 5. Start development servers
pnpm dev            # Starts all apps concurrently

# Individual apps:
pnpm dev:web        # Storefront on http://localhost:3000
pnpm dev:admin      # Admin on http://localhost:3001
pnpm dev:api        # API on http://localhost:4000
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values.

See full list in [`.env.example`](.env.example).

**Critical variables:**

```env
DATABASE_URL=postgresql://splaro:PASSWORD@localhost:5432/splaro_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-256-bit-secret
NEXT_PUBLIC_SITE_URL=https://splaro.co
NEXT_PUBLIC_API_URL=https://api.splaro.co

# Payments
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
NAGAD_MERCHANT_ID=
NAGAD_MERCHANT_PRIVATE_KEY=
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=

# Couriers
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
REDX_API_KEY=
PAPERFLY_API_KEY=

# Storage
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=

# AI
OPENAI_API_KEY=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# SMS
SMS_API_KEY=         # SSL Wireless / Alpha SMS

# WhatsApp
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY=  # Path to credentials JSON
GOOGLE_SHEETS_ORDERS_ID=     # Spreadsheet ID
GOOGLE_SHEETS_INVENTORY_ID=
```

---

## Deployment

> **Production deploy:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Hostinger KVM VPS (Ubuntu, Nginx, PM2, Let's Encrypt).  
> **Bangla quick start:** [docs/VPS-GO-LIVE-BN.md](docs/VPS-GO-LIVE-BN.md)  
> Before pushing `main`: `pnpm check:web && pnpm check:admin && pnpm check:api && pnpm validate:production-env`.

### VPS go-live (from Mac)

```bash
pnpm prep:vps          # local checks + optional build
bash infrastructure/vps/go-live.sh   # on the VPS after clone
```

### Hostinger VPS setup

```bash
# 1. SSH into your VPS
ssh root@YOUR_VPS_IP

# 2. Run server setup script
chmod +x infrastructure/scripts/setup-server.sh
./infrastructure/scripts/setup-server.sh

# 3. Configure Nginx
cp infrastructure/nginx/*.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/splaro-web.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 4. Deploy application
chmod +x infrastructure/scripts/deploy.sh
./infrastructure/scripts/deploy.sh

# 5. Start with PM2
pm2 start infrastructure/pm2/ecosystem.config.js
pm2 save
pm2 startup
```

### Production Build

```bash
pnpm build:all      # Build all apps
pnpm db:migrate     # Run pending migrations
pnpm start:all      # Start production servers
```

See full deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## SEO Strategy

- **Next.js Metadata API** — Dynamic titles, descriptions, OG images
- **Structured Data** — Product, BreadcrumbList, Organization, FAQPage schemas
- **Dynamic Sitemap** — Auto-generated with next-sitemap
- **Robots.txt** — Proper crawl directives
- **Open Graph** — Dynamic OG images per product/collection
- **Canonical URLs** — Prevents duplicate content
- **Core Web Vitals** — LCP < 2.5s, CLS < 0.1, FID < 100ms
- **Image Optimization** — Next/Image with Cloudflare R2 CDN
- **Font Optimization** — Self-hosted WOFF2, font-display: swap
- **Schema Markup** — Rich snippets for products + reviews

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|---------|
| Lighthouse Score | 95+ | SSG/SSR, image opt |
| LCP | < 2.5s | CDN, preload, hero opt |
| CLS | < 0.1 | Reserved image dimensions |
| FID / INP | < 100ms | Code splitting, hydration |
| TTFB | < 200ms | Edge caching, Redis |
| Bundle Size | < 150KB JS | Tree shaking, lazy load |

---

## Contributing

This is a proprietary project. Internal team only.

1. Create feature branch from `main`
2. Follow TypeScript strict mode
3. Write tests for new API endpoints
4. Follow the Prisma migration naming convention
5. Open PR with description + screenshots

---

## License

Copyright © 2026 SPLARO. All rights reserved.

This codebase is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

---

<div align="center">
  
  **Built with precision for the modern woman.**
  
  SPLARO — Timeless. Feminine. You.

</div>
