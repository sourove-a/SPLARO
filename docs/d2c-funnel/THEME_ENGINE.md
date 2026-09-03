# Dynamic Luxury Theme Engine: Technical Specification

This document defines the CSS tokens, presets, and visual physics governing the bespoke dynamic theme engine on the D2C Funnel Platform.

---

## 1. Theme Presets & Color Psychology

### 👑 Preset 1: Obsidian & Champagne Gold
- **Vibe:** Moody, high-end, bespoke luxury, Swiss watch aesthetic.
- **Tokens:**
  - `--funnel-bg`: `#0b0c0e`
  - `--funnel-surface`: `#131519`
  - `--funnel-accent`: `#c8a97e`
  - `--funnel-glow`: `rgba(200, 169, 126, 0.28)`
  - `--funnel-btn-bg`: `linear-gradient(135deg, #c8a97e 0%, #b39160 100%)`
  - `--funnel-btn-text`: `#0b0c0e`

### 🌿 Preset 2: Midnight Emerald
- **Vibe:** Regal heritage, deep forest velvet, botanical exclusivity.
- **Tokens:**
  - `--funnel-bg`: `#08130e`
  - `--funnel-surface`: `#0e1e17`
  - `--funnel-accent`: `#34d399`
  - `--funnel-glow`: `rgba(52, 211, 153, 0.25)`
  - `--funnel-btn-bg`: `linear-gradient(135deg, #059669 0%, #047857 100%)`
  - `--funnel-btn-text`: `#ffffff`

### ⚙️ Preset 3: Titanium Silver & Glass
- **Vibe:** Apple-style precision engineering, sleek EDC gear, icy clarity.
- **Tokens:**
  - `--funnel-bg`: `#0e1013`
  - `--funnel-surface`: `#181b20`
  - `--funnel-accent`: `#e2e8f0`
  - `--funnel-glow`: `rgba(226, 232, 240, 0.2)`
  - `--funnel-btn-bg`: `linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)`
  - `--funnel-btn-text`: `#0f172a`

### 🏜️ Preset 4: Warm Sand & Terracotta
- **Vibe:** Mediterranean summer, artisanal leather, organic linen warmth.
- **Tokens:**
  - `--funnel-bg`: `#141210`
  - `--funnel-surface`: `#1e1b18`
  - `--funnel-accent`: `#d49a6a`
  - `--funnel-glow`: `rgba(212, 154, 106, 0.24)`
  - `--funnel-btn-bg`: `linear-gradient(135deg, #d49a6a 0%, #ba7e4d 100%)`
  - `--funnel-btn-text`: `#141210`

### 🎨 Custom Hex Mode
- When an admin enters a custom hex code (e.g. `#7B1FA2`), the engine mathematically computes:
  - Background surface tint: `color-mix(in srgb, var(--custom-hex) 8%, #0d0e11)`
  - Ambient backlight glow: `color-mix(in srgb, var(--custom-hex) 30%, transparent)`
  - Primary button gradient: `linear-gradient(135deg, var(--custom-hex), color-mix(in srgb, var(--custom-hex) 85%, black))`

---

## 2. Visual Haptics & Tactile Motion Standards

```css
/* Tactile Cushioned Press */
.funnel-btn {
  transition: 
    transform 300ms cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 300ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 300ms cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

.funnel-btn:active:not(:disabled) {
  transform: scale(0.985);
  opacity: 0.9;
}

/* 700ms Slow Luxury Image Hover */
.funnel-image-frame {
  overflow: hidden;
  border-radius: 16px;
  position: relative;
}

.funnel-image-frame img {
  transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
  -webkit-backface-visibility: hidden;
}

.funnel-image-frame:hover img {
  transform: scale(1.045);
}
```
