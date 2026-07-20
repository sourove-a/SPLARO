# Storefront Performance Parity — Phase 0 Baseline (2026-07-16)

Source: Playwright networkidle on https://splaro.co/

| Metric | Value |
|--------|------:|
| DOMContentLoaded | 1888 ms |
| Load | 2157 ms |
| Transfer approx | 3,120,054 B (~3.1 MB) |
| Resources | 77 |
| Largest CSS | 564,425 B (`a7a9035cb32e7baf.css`) |
| Fetches | 14 |

Cache-Control on `/` (Contabo): both `s-maxage=60, stale-while-revalidate=300` and `no-store, no-cache, must-revalidate, max-age=0` present (conflict).

## Local deltas after Phases 1–6 (pre-deploy)

| Change | Result |
|--------|--------|
| Phase 1–2 CSS purge/dedup | Dead rev/reels/story/ws + Lenis-only + legacy mm; superseded pp-view + dead product-sheet/ed-hero |
| Phase 3 CSS route-split | Root `globals.css` ~192 KB; page sheets under `styles/pages/*` (auth/home/shop/checkout/account/content/pdp) |
| Phase 4 JS | Lenis temporarily removed for reliability; **restored 2026-07-21** as Mac/Linux fine-desktop only (Windows stays native) — see `SKILL.md` Scroll + click |
| Phase 5 images/cache | Local placeholders via `@splaro/config`; Next private-route cache; nginx `/images/hero/` immutable |
| Phase 6 waterfall | Home defers `/api/auth/me` until interaction / 8s (2s if cart session); checkout/cart/auth immediate |

**Ship gate:** ask owner before push/deploy — then re-measure live with the same Playwright script vs this baseline.
