import type { InvoiceViewModel } from './invoice.helpers'
import { buildInvoiceViewModel, escapeHtml } from './invoice.helpers'
import { InvoiceDocument } from './invoice-document.components'
import { generateInvoiceEmailBody } from './invoice-email-body.template'
import { invoiceLeatherGrainDataUri, invoiceLogoDataUri } from './invoice-assets'

export interface InvoiceTemplateOptions {
  showToolbar?: boolean
  autoPrint?: boolean
  /** `fragment` = inner invoice only (for email embed). Default `full` document. */
  mode?: 'full' | 'fragment'
}

function premiumLogoUrl(siteUrl: string): string {
  return invoiceLogoDataUri(siteUrl)
}

const invoiceFontFaces = `
  @font-face {
    font-family: "Cormorant Garamond";
    font-style: italic;
    font-weight: 500;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf) format("truetype");
  }
  @font-face {
    font-family: "Cormorant Garamond";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_s06GnM.ttf) format("truetype");
  }
  @font-face {
    font-family: "Cormorant Garamond";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9GnM.ttf) format("truetype");
  }
  @font-face {
    font-family: "Manrope";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf) format("truetype");
  }
  @font-face {
    font-family: "Manrope";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk7PFO_F.ttf) format("truetype");
  }
  @font-face {
    font-family: "Manrope";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4jE-_F.ttf) format("truetype");
  }
  @font-face {
    font-family: "Manrope";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE-_F.ttf) format("truetype");
  }
`

const invoiceStyles = `
  ${invoiceFontFaces}

  :root {
    color-scheme: light;
    --invoice-ivory: #f3ebe0;
    --invoice-pearl: #faf4eb;
    --invoice-cream: #e8dccb;
    --invoice-recess: #ebe1d3;
    --invoice-ink: #1c1510;
    --invoice-espresso: #2a1f18;
    --invoice-charcoal: #4a4038;
    --invoice-muted: #7a6e62;
    --invoice-gold: #c6a46a;
    --invoice-gold-soft: #e0c790;
    --invoice-gold-deep: #9a7844;
    --invoice-thread: rgba(154, 120, 68, 0.72);
    --invoice-serif: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    --invoice-sans: "Manrope", "Segoe UI", Arial, sans-serif;
    --invoice-leather: url("__LEATHER_URL__");
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    min-height: 100%;
    background: radial-gradient(ellipse at 50% -8%, #e8e0d4 0%, transparent 52%), #c8c0b4;
    color: var(--invoice-ink);
    font-family: var(--invoice-sans);
    font-size: 10px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body { padding: 20px 12px 28px; }

  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }

  .invoice-toolbar {
    position: sticky; top: 10px; z-index: 20;
    display: flex; justify-content: center;
    width: min(210mm, 100%); margin: 0 auto 12px;
  }

  .invoice-toolbar button {
    border: 1px solid rgba(198, 164, 106, 0.7);
    border-radius: 999px;
    background: var(--invoice-espresso);
    color: #fff8ee;
    cursor: pointer;
    font: 700 9px/1 var(--invoice-sans);
    letter-spacing: 0.18em;
    padding: 11px 22px;
    text-transform: uppercase;
    box-shadow: 0 8px 22px rgba(30, 22, 16, 0.14);
  }

  .invoice-toolbar button:focus-visible {
    outline: 2px solid var(--invoice-gold);
    outline-offset: 3px;
  }

  .invoice-shell { width: min(210mm, 100%); margin: 0 auto; }

  .invoice-document {
    position: relative;
    isolation: isolate;
    width: 210mm;
    overflow: hidden;
    padding: 10mm 12mm 9mm;
    border-radius: 3mm;
    background: #f4ece1;
    box-shadow:
      0 30px 70px rgba(40, 28, 18, 0.22),
      0 8px 18px rgba(40, 28, 18, 0.1),
      inset 0 1px 0 rgba(255,255,255,0.55);
  }

  .invoice-document__leather {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-color: #f4ece1;
    background-image:
      linear-gradient(155deg, rgba(255,255,255,0.3), transparent 42%),
      var(--invoice-leather);
    background-size: auto, 130px 130px;
    background-repeat: no-repeat, repeat;
    mix-blend-mode: multiply;
  }

  .invoice-document__light {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse at 22% 8%, rgba(255,255,255,0.55), transparent 42%),
      radial-gradient(ellipse at 85% 90%, rgba(170,130,80,0.1), transparent 40%);
  }

  .invoice-document__stitch {
    position: absolute; pointer-events: none; z-index: 1; border-radius: 2mm;
  }

  .invoice-document__stitch--outer {
    inset: 3.4mm;
    border: 0.35mm solid rgba(150, 118, 70, 0.42);
    box-shadow: inset 0 0 0 0.15mm rgba(255,255,255,0.35);
  }

  .invoice-document__stitch--outer::after {
    content: "";
    position: absolute;
    inset: 1.4mm;
    border: 0.55mm dashed rgba(150, 118, 70, 0.62);
    border-radius: 1.4mm;
    box-shadow: 0 0.2mm 0 rgba(255,255,255,0.25);
  }

  .invoice-document__stitch--inner {
    inset: 6mm;
    border: 0.2mm solid rgba(198, 164, 106, 0.28);
  }

  .invoice-hangtag {
    position: absolute;
    top: 3.2mm;
    left: 7.5mm;
    z-index: 4;
    width: 23mm;
    pointer-events: none;
    filter: drop-shadow(1.5mm 2mm 2.5mm rgba(40,28,18,0.2));
  }

  .invoice-hangtag__cord {
    display: block;
    width: 12mm;
    height: 14mm;
    margin: 0 auto -1.2mm;
  }

  .invoice-hangtag__body {
    position: relative;
    display: grid;
    place-items: center;
    gap: 0.7mm;
    width: 19mm;
    height: 31mm;
    margin: 0 auto;
    border-radius: 1.5mm;
    background-color: #f0e6d8;
    background-image:
      linear-gradient(160deg, rgba(255,255,255,0.4), transparent),
      var(--invoice-leather);
    background-size: auto, 70px 70px;
    border: 0.28mm solid rgba(150, 118, 70, 0.5);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.6),
      inset 0 -1px 2px rgba(90,60,30,0.08);
  }

  .invoice-hangtag__body::after {
    content: "";
    position: absolute;
    inset: 0.9mm;
    border: 0.35mm dashed rgba(150,118,70,0.4);
    border-radius: 0.9mm;
    pointer-events: none;
  }

  .invoice-hangtag__body::before {
    content: "";
    position: absolute;
    top: 2mm;
    left: 50%;
    width: 2.8mm;
    height: 2.8mm;
    border: 0.45mm solid rgba(133, 94, 43, 0.78);
    border-radius: 50%;
    background: #d8c5aa;
    box-shadow: inset 0 0.4mm 0.6mm rgba(55, 37, 20, 0.24);
    transform: translateX(-50%);
  }

  .invoice-hangtag__mark {
    position: relative;
    z-index: 1;
    font-family: var(--invoice-serif);
    margin-top: -1mm;
    font-size: 9mm;
    font-weight: 600;
    line-height: 1;
    background: linear-gradient(180deg, #f2d9a4 0%, #c6a46a 45%, #8a6534 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0.5px 0 rgba(255,255,255,0.45));
  }

  .invoice-hangtag__star {
    position: relative;
    z-index: 1;
    width: 2.4mm;
    height: 2.4mm;
    background: linear-gradient(135deg, #f0d9a0, #9a7640);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    margin-top: 3.8mm;
  }

  .invoice-document__content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 4mm;
  }

  .invoice-edge-ribbon {
    position: absolute;
    z-index: 3;
    width: 112mm;
    height: 40mm;
    overflow: visible;
    fill: none;
    pointer-events: none;
    stroke-linecap: round;
    filter: drop-shadow(0 0.35mm 0.45mm rgba(91, 61, 29, 0.16));
  }

  .invoice-edge-ribbon path:first-child {
    stroke: rgba(154, 112, 48, 0.76);
    stroke-width: 1.8;
  }

  .invoice-edge-ribbon path:last-child {
    stroke: rgba(224, 199, 144, 0.7);
    stroke-width: 0.85;
  }

  .invoice-edge-ribbon--top {
    top: -6mm;
    left: -22mm;
    transform: rotate(-5deg);
  }

  .invoice-edge-ribbon--bottom {
    right: -22mm;
    bottom: -6mm;
    transform: rotate(-5deg);
  }

  .invoice-panel {
    position: relative;
    border-radius: 2.6mm;
    background-color: #ebe1d3;
    background-image:
      linear-gradient(180deg, rgba(255,255,255,0.22), rgba(232,221,208,0.35)),
      var(--invoice-leather);
    background-size: auto, 120px 120px;
    border: 0.28mm solid rgba(150,118,70,0.42);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.45),
      inset 0 0 10mm rgba(90,60,30,0.05),
      0 1.5mm 4mm rgba(40,28,18,0.06);
  }

  .invoice-panel::before {
    content: "";
    position: absolute;
    inset: 1.2mm;
    border: 0.5mm dashed rgba(150,118,70,0.48);
    border-radius: 1.8mm;
    pointer-events: none;
    z-index: 0;
  }

  .invoice-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: 5mm;
    margin-bottom: 4mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-header__logo {
    display: block;
    width: 58mm;
    height: auto;
    max-height: 32mm;
    object-fit: contain;
    filter: drop-shadow(0 1px 1.5px rgba(90,60,30,0.18));
  }

  .invoice-header__divider {
    display: flex;
    align-items: center;
    gap: 2mm;
    width: 38mm;
    margin-top: 2.2mm;
  }

  .invoice-header__divider::before,
  .invoice-header__divider::after {
    content: "";
    flex: 1;
    height: 0.2mm;
    background: linear-gradient(90deg, transparent, rgba(154, 120, 68, 0.68));
  }

  .invoice-header__divider::after {
    background: linear-gradient(90deg, rgba(154, 120, 68, 0.68), transparent);
  }

  .invoice-header__title {
    display: inline-flex;
    align-items: center;
    gap: 1.6mm;
    margin-top: 2.2mm;
    color: var(--invoice-gold-deep);
    font-family: var(--invoice-serif);
    font-size: 5.2mm;
    font-weight: 600;
    letter-spacing: 0.32em;
    line-height: 1;
    text-indent: 0.32em;
    text-transform: uppercase;
  }

  .invoice-spark {
    width: 2mm;
    height: 2mm;
    background: linear-gradient(135deg, #f0d9a0, #9a7844);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    flex: 0 0 auto;
  }

  .invoice-header__number {
    display: inline-flex;
    align-items: center;
    gap: 0.6mm;
    margin-top: 2.5mm;
    padding: 1.25mm 4mm;
    border: 0.28mm solid rgba(154, 120, 68, 0.55);
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,0.45), rgba(235,225,211,0.5));
    box-shadow: inset 0 1px 2px rgba(80,55,30,0.08), inset 0 1px 0 rgba(255,255,255,0.65);
    color: var(--invoice-gold-deep);
    font-size: 2.35mm;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .invoice-header__number strong {
    color: var(--invoice-espresso);
    font-size: 2.7mm;
    font-weight: 700;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }

  .invoice-status {
    margin-top: 1.4mm;
    padding: 0.7mm 2.4mm;
    border-radius: 999px;
    border: 0.18mm solid rgba(154, 120, 68, 0.35);
    color: var(--invoice-charcoal);
    font-size: 1.85mm;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: rgba(255,252,246,0.5);
  }

  .invoice-status--paid { border-color: rgba(120,140,100,0.45); color: #3d4a36; }
  .invoice-status--pending { border-color: rgba(154,125,79,0.5); color: var(--invoice-gold-deep); }
  .invoice-status--cancelled { border-color: rgba(120,80,70,0.4); color: #5a3c36; }

  .invoice-meta {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: 7mm;
    min-height: 40mm;
    padding: 1mm 3mm 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-bill {
    position: relative;
    padding: 2mm 0 2mm 7mm;
  }

  .invoice-bill::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 0.22mm;
    background: linear-gradient(180deg, transparent, var(--invoice-gold-deep) 18%, var(--invoice-gold-deep) 82%, transparent);
  }

  .invoice-bill::after {
    content: "✦";
    position: absolute;
    top: 50%;
    left: 0;
    color: var(--invoice-gold-deep);
    font-size: 3.4mm;
    line-height: 1;
    transform: translate(-48%, -50%);
  }

  .invoice-kicker {
    color: var(--invoice-gold-deep);
    font-size: 2mm;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .invoice-bill h2 {
    margin-top: 1.2mm;
    color: var(--invoice-espresso);
    font-family: var(--invoice-serif);
    font-size: 5.3mm;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .invoice-bill address {
    max-width: 78mm;
    margin-top: 1.2mm;
    color: var(--invoice-muted);
    font-style: normal;
    font-size: 2.55mm;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .invoice-bill__contact {
    display: flex; flex-wrap: wrap; gap: 1mm 2.8mm;
    margin-top: 1.2mm;
    color: var(--invoice-espresso);
    font-size: 2.15mm;
    font-weight: 600;
  }

  .invoice-bill__contact:empty { display: none; }

  .invoice-bill__contact span + span::before {
    content: "·"; margin-right: 2.8mm; color: var(--invoice-gold);
  }

  .invoice-facts {
    display: grid;
    align-content: start;
    padding-left: 7mm;
    border-left: 0.22mm solid rgba(154, 120, 68, 0.48);
  }

  .invoice-fact {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 3mm;
    min-height: 11.5mm;
    border-bottom: 0.2mm dashed rgba(154, 120, 68, 0.3);
  }

  .invoice-fact:last-child { border-bottom: 0; }

  .invoice-fact dt {
    display: flex; align-items: center; gap: 1.8mm;
    color: var(--invoice-muted);
    font-size: 2.15mm;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .invoice-fact dd {
    color: var(--invoice-espresso);
    font-size: 2.55mm;
    font-weight: 700;
    text-align: right;
    max-width: 42mm;
    overflow-wrap: anywhere;
  }

  .invoice-fact__badge {
    display: inline-block;
    padding: 0.4mm 1.6mm;
    border: 0.18mm solid rgba(154, 120, 68, 0.42);
    border-radius: 999px;
    font-size: 1.85mm;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .invoice-fact__icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 6.2mm; height: 6.2mm;
    border: 0.28mm solid rgba(198, 164, 106, 0.75);
    border-radius: 50%;
    color: var(--invoice-gold-deep);
    background: linear-gradient(160deg, rgba(255,255,255,0.55), rgba(235,225,211,0.4));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.65), 0 0.5mm 1mm rgba(90,60,30,0.06);
    flex: 0 0 auto;
  }

  .invoice-fact__icon svg {
    width: 3.4mm; height: 3.4mm;
    fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.35;
  }

  .invoice-items { overflow: hidden; }

  .invoice-items table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    position: relative;
    z-index: 1;
  }

  .invoice-items thead { display: table-header-group; }

  .invoice-items th {
    position: relative;
    z-index: 1;
    padding: 2.6mm 3.2mm 2.2mm;
    color: var(--invoice-charcoal);
    font-size: 2.2mm;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-align: right;
    text-transform: uppercase;
    border-top: 0.2mm solid rgba(154, 120, 68, 0.38);
    border-bottom: 0.28mm solid rgba(154, 120, 68, 0.68);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.2), rgba(225,210,190,0.32)),
      var(--invoice-leather);
    background-size: auto, 120px 120px;
  }

  .invoice-items th:first-child { width: 54%; text-align: left; }
  .invoice-items th:nth-child(2) { width: 10%; }
  .invoice-items th:nth-child(3),
  .invoice-items th:nth-child(4) { width: 18%; }

  .invoice-items tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-items td {
    position: relative;
    z-index: 1;
    height: 17.5mm;
    padding: 2.4mm 3.2mm;
    border-bottom: 0.2mm dashed rgba(154, 120, 68, 0.28);
    color: var(--invoice-muted);
    font-size: 2.35mm;
    vertical-align: middle;
  }

  .invoice-items tbody tr:last-child td { border-bottom: 0; }

  .invoice-items--compact td {
    height: 23mm;
  }

  .invoice-items--compact .invoice-item__thumb {
    width: 17mm;
    height: 18mm;
  }

  .invoice-items--sparse td {
    height: 28mm;
  }

  .invoice-items--sparse .invoice-item__thumb {
    width: 23mm;
    height: 24mm;
  }

  .invoice-items--balanced td {
    height: 24mm;
  }

  .invoice-items--balanced .invoice-item__thumb {
    width: 18mm;
    height: 20mm;
  }

  .invoice-item { display: flex; align-items: center; gap: 2.8mm; }

  .invoice-item__thumb {
    position: relative;
    display: grid; place-items: center;
    width: 13.5mm; height: 14mm;
    overflow: hidden;
    border: 0.28mm solid rgba(198, 164, 106, 0.65);
    border-radius: 1.4mm;
    background: linear-gradient(145deg, #efe4d2, #faf4eb);
    box-shadow:
      inset 0 0 0 0.35mm rgba(255,255,255,0.45),
      0 0 0 0.35mm rgba(126, 87, 35, 0.26);
    flex: 0 0 auto;
  }

  .invoice-item__thumb img {
    position: absolute; inset: 0;
    display: block; width: 100%; height: 100%; object-fit: cover;
  }

  .invoice-item__fallback {
    color: rgba(154, 120, 68, 0.7);
    font-family: var(--invoice-serif);
    font-size: 4.4mm;
    font-weight: 600;
  }

  .invoice-item__copy { display: grid; min-width: 0; gap: 0.4mm; }

  .invoice-item__copy::after {
    content: "";
    width: 8mm;
    height: 0.3mm;
    margin-top: 0.4mm;
    background: linear-gradient(90deg, var(--invoice-gold-deep), transparent);
  }

  .invoice-item__copy strong {
    overflow: hidden;
    color: var(--invoice-espresso);
    font-family: var(--invoice-serif);
    font-size: 3.15mm;
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }

  .invoice-item__copy small,
  .invoice-item__sku {
    color: var(--invoice-muted);
    font-size: 1.95mm;
    font-weight: 500;
  }

  .invoice-number {
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  .invoice-number--strong {
    color: var(--invoice-espresso) !important;
    font-weight: 700;
  }

  .invoice-items__empty { color: var(--invoice-muted); text-align: center; }

  .invoice-closing {
    display: grid;
    grid-template-columns: 80mm minmax(0, 1fr);
    align-items: stretch;
    gap: 5mm;
    margin-top: 0;
    padding-top: 1mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-thanks {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3.5mm 5mm;
    max-width: none;
    min-height: 36mm;
    background-image:
      linear-gradient(90deg, rgba(150,118,70,0.1) 1px, transparent 1px),
      linear-gradient(rgba(150,118,70,0.1) 1px, transparent 1px),
      linear-gradient(160deg, rgba(255,255,255,0.28), rgba(232,221,208,0.4)),
      var(--invoice-leather);
    background-size: 4.5mm 4.5mm, 4.5mm 4.5mm, auto, 110px 110px;
  }

  .invoice-thanks--quilt {
    /* class retained for markup compatibility */
  }

  .invoice-thanks__title {
    font-family: "Snell Roundhand", "Apple Chancery", "Segoe Script", var(--invoice-serif);
    font-size: 6.2mm;
    font-style: italic;
    font-weight: 500;
    line-height: 1;
    color: var(--invoice-gold-deep);
    filter: drop-shadow(0 0.4px 0 rgba(255,255,255,0.35));
  }

  .invoice-thanks p:last-child {
    margin-top: 1.4mm;
    color: var(--invoice-muted);
    font-size: 2.15mm;
  }

  .invoice-summary {
    min-height: 36mm;
    overflow: hidden;
    padding: 2.2mm 0;
    position: relative;
    z-index: 1;
  }

  .invoice-summary > div {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    padding: 1.15mm 3.4mm;
    color: var(--invoice-muted);
    font-size: 2.2mm;
  }

  .invoice-summary dd {
    color: var(--invoice-espresso);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .invoice-summary__divider {
    display: flex !important;
    justify-content: center !important;
    align-items: center;
    padding: 0.9mm 3.4mm !important;
  }

  .invoice-summary__divider span {
    position: relative;
    display: block;
    width: 100%;
    height: 0.2mm;
    background: linear-gradient(90deg, transparent, rgba(154,120,68,0.45), transparent);
  }

  .invoice-summary__divider span::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2.2mm;
    height: 2.2mm;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #f0d9a0, #9a7844);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  }

  .invoice-summary__total {
    align-items: baseline;
    padding: 1.5mm 3.4mm 1.8mm !important;
    background: transparent !important;
  }

  .invoice-summary__total dt {
    color: var(--invoice-gold-deep);
    font-size: 2.2mm;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .invoice-summary__total dd {
    font-family: var(--invoice-serif);
    font-size: 5mm;
    font-weight: 600;
    line-height: 1;
    background: linear-gradient(180deg, #f0d9a0 0%, #c6a46a 45%, #8d6a38 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0.4px 0 rgba(255,255,255,0.35));
  }

  .invoice-footer {
    position: relative;
    margin-top: 0;
    padding: 3.8mm 4mm;
    border: 0.28mm solid rgba(150, 118, 70, 0.42);
    border-radius: 999px;
    background-color: #ebe1d3;
    background-image:
      linear-gradient(160deg, rgba(255,255,255,0.28), rgba(232,221,208,0.42)),
      var(--invoice-leather);
    background-size: auto, 100px 100px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.5),
      0 1mm 2.8mm rgba(40,28,18,0.06);
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-footer::before {
    content: "";
    position: absolute;
    inset: 1mm;
    border: 0.45mm dashed rgba(150, 118, 70, 0.43);
    border-radius: 999px;
    pointer-events: none;
  }

  .invoice-footer address {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1.5mm 4mm;
    color: var(--invoice-muted);
    font-style: normal;
    font-size: 1.9mm;
    font-weight: 600;
    letter-spacing: 0.03em;
    line-height: 1.5;
  }

  .invoice-footer__item {
    display: inline-flex;
    align-items: center;
    gap: 1.2mm;
  }

  .invoice-footer__icon {
    display: inline-flex;
    color: var(--invoice-gold-deep);
  }

  .invoice-footer__icon svg {
    width: 2.4mm;
    height: 2.4mm;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (max-width: 840px) {
    body { padding: 10px 0 20px; }
    .invoice-shell {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0 10px 12px;
    }
    .invoice-hangtag { opacity: 0.95; }
  }

  @media print {
    @page { size: A4 portrait; margin: 8mm; }

    html, body { background: #f4ece1 !important; }
    body { position: relative; padding: 0; }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -20;
      background-color: #f4ece1;
      background-image:
        linear-gradient(155deg, rgba(255,255,255,0.3), transparent 42%),
        var(--invoice-leather);
      background-size: auto, 130px 130px;
      background-repeat: no-repeat, repeat;
    }

    body::after {
      content: "";
      position: fixed;
      inset: 2mm;
      z-index: -10;
      border: 0.45mm dashed rgba(150, 118, 70, 0.62);
      border-radius: 1.5mm;
      pointer-events: none;
    }

    .invoice-toolbar { display: none !important; }

    .invoice-shell {
      width: auto; margin: 0; overflow: visible; padding: 0;
    }

    .invoice-document {
      width: 100%;
      min-height: 281mm;
      border-radius: 0;
      box-shadow: none;
    }

    .invoice-document__content { min-height: 0; }
    .invoice-footer { margin-top: 0; }

    .invoice-items { overflow: visible; }
    .invoice-items thead { display: table-header-group; }

    .invoice-header,
    .invoice-meta,
    .invoice-closing,
    .invoice-summary,
    .invoice-footer,
    .invoice-items tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`

/**
 * Premium A4 invoice document. Existing service architecture remains unchanged:
 * order -> typed view model -> semantic document components -> HTML/PDF.
 */
export function generateInvoiceHTML(
  model: InvoiceViewModel,
  options: InvoiceTemplateOptions = {},
): string {
  if (options.mode === 'fragment') return generateInvoiceEmailBody(model)

  const showToolbar = options.showToolbar ?? model.showToolbar
  const autoPrint = options.autoPrint ?? model.autoPrint
  const logoUrl = premiumLogoUrl(model.siteUrl)
  const leatherUrl = invoiceLeatherGrainDataUri(model.siteUrl)
  const styles = invoiceStyles.replace('url("__LEATHER_URL__")', `url("${leatherUrl}")`)
  const document = InvoiceDocument({ model, logoUrl })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escapeHtml(model.invoiceNumber)} - ${escapeHtml(model.brand.name)}</title>
  <style>${styles}</style>
</head>
<body>
  ${
    showToolbar
      ? '<div class="invoice-toolbar"><button type="button" onclick="window.print()">Print / Save PDF</button></div>'
      : ''
  }
  <main class="invoice-shell">${document}</main>
  ${
    autoPrint
      ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));</script>'
      : ''
  }
</body>
</html>`
}

export function generateInvoiceHTMLFromOrder(
  data: import('./invoice.helpers').InvoiceOrder & {
    invoiceNumber: string
    storeName?: string
    storeLogo?: string
    storeEmail?: string
    storePhone?: string
    siteUrl?: string
    customerEmail?: string | null
  },
  options?: InvoiceTemplateOptions,
): string {
  const model = buildInvoiceViewModel({
    order: data,
    storeName: data.storeName,
    storeLogo: data.storeLogo,
    storeEmail: data.storeEmail,
    storePhone: data.storePhone,
    siteUrl: data.siteUrl,
    customerEmail: data.customerEmail,
  })
  return generateInvoiceHTML(model, options)
}
