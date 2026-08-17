import type { InvoiceViewModel } from './invoice.helpers'
import { escapeHtml, formatBdt } from './invoice.helpers'

export interface InvoiceDocumentProps {
  model: InvoiceViewModel
  logoUrl: string
}

function itemVariant(item: InvoiceViewModel['items'][number]): string {
  return [item.size !== '—' ? item.size : '', item.color !== '—' ? item.color : '']
    .filter(Boolean)
    .join(' · ')
}

function productThumbnail(item: InvoiceViewModel['items'][number]): string {
  const initial = escapeHtml(item.productName.charAt(0).toUpperCase() || 'S')
  const image = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="eager" onerror="this.remove()" />`
    : ''

  return `
    <span class="invoice-item__thumb" aria-hidden="true">
      <span class="invoice-item__fallback">${initial}</span>
      ${image}
    </span>`
}

function metaIcon(kind: 'calendar' | 'clock' | 'card' | 'receipt' | 'status'): string {
  if (kind === 'calendar') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9.25h15M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z"/></svg>`
  }
  if (kind === 'clock') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`
  }
  if (kind === 'receipt') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2v-15a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3.5"/></svg>`
  }
  if (kind === 'status') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5.2"/></svg>`
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M3.5 10h17M7 15h3.5"/></svg>`
}

function footerIcon(kind: 'pin' | 'web' | 'phone' | 'mail'): string {
  if (kind === 'pin') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>`
  }
  if (kind === 'web') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5M12 3.5C9.6 6.1 8.4 8.9 8.4 12s1.2 5.9 3.6 8.5"/></svg>`
  }
  if (kind === 'phone') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 4.8h2.4l1.1 3.2-1.5 1.5a11 11 0 0 0 4.8 4.8l1.5-1.5 3.2 1.1v2.4A1.8 1.8 0 0 1 18 18.1 13.3 13.3 0 0 1 5.9 6 1.8 1.8 0 0 1 8.2 4.8Z"/></svg>`
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="1.6"/><path d="m4.2 7.2 7.8 6.2 7.8-6.2"/></svg>`
}

function factRow(
  icon: 'calendar' | 'clock' | 'card' | 'receipt' | 'status',
  label: string,
  value: string,
): string {
  if (!value || value === '—') return ''
  return `
    <div class="invoice-fact">
      <dt>
        <span class="invoice-fact__icon">${metaIcon(icon)}</span>
        <span class="invoice-fact__label">${escapeHtml(label)}</span>
      </dt>
      <dd>${value}</dd>
    </div>`
}

export function InvoiceHeader({ model, logoUrl }: InvoiceDocumentProps): string {
  return `
    <header class="invoice-header">
      <img
        class="invoice-header__logo"
        src="${escapeHtml(logoUrl)}"
        alt="${escapeHtml(model.brand.name)}"
        width="200"
        height="110"
      />
      <div class="invoice-header__divider" aria-hidden="true">
        <span class="invoice-spark"></span>
      </div>
      <p class="invoice-header__title">Invoice</p>
      <p class="invoice-header__number">
        <span>#</span><strong>${escapeHtml(model.invoiceNumber)}</strong>
      </p>
    </header>`
}

export function InvoiceMeta({ model }: Pick<InvoiceDocumentProps, 'model'>): string {
  const email =
    model.customerEmail && model.customerEmail !== '—'
      ? `<span>${escapeHtml(model.customerEmail)}</span>`
      : ''
  const phone =
    model.customerPhone && model.customerPhone !== '—'
      ? `<span>${escapeHtml(model.customerPhone)}</span>`
      : ''
  const address =
    model.customerAddress && model.customerAddress !== '—'
      ? `<address>${escapeHtml(model.customerAddress)}</address>`
      : ''

  return `
    <section class="invoice-meta" aria-label="Billing and invoice information">
      <div class="invoice-bill">
        <p class="invoice-kicker">Bill to</p>
        <h2>${escapeHtml(model.customerName)}</h2>
        ${address}
        <p class="invoice-bill__contact">
          ${phone}
          ${email}
        </p>
      </div>

      <dl class="invoice-facts">
        ${factRow('calendar', 'Invoice date', escapeHtml(model.issueDate))}
        ${factRow('clock', 'Due date', escapeHtml(model.dueDate))}
        ${factRow('card', 'Payment method', escapeHtml(model.paymentMethod))}
      </dl>
    </section>`
}

export function InvoiceItemsTable({ model }: Pick<InvoiceDocumentProps, 'model'>): string {
  const rowClass =
    model.items.length <= 2
      ? 'invoice-items--compact'
      : model.items.length === 3
        ? 'invoice-items--sparse'
      : model.items.length === 4
        ? 'invoice-items--balanced'
        : ''
  const rows = model.items
    .map((item) => {
      const variant = itemVariant(item)
      // Product Code is what a customer quotes when they call; the variant SKU
      // is what the warehouse pulls. Both belong on the line, code first.
      const codeParts = [
        item.productCode ? `Code ${escapeHtml(item.productCode)}` : '',
        item.sku && item.sku !== '—' ? `SKU ${escapeHtml(item.sku)}` : '',
      ].filter(Boolean)
      const sku = codeParts.length
        ? `<small class="invoice-item__sku">${codeParts.join(' · ')}</small>`
        : ''
      return `
        <tr>
          <td class="invoice-item">
            ${productThumbnail(item)}
            <span class="invoice-item__copy">
              <strong>${escapeHtml(item.productName)}</strong>
              ${variant ? `<small>${escapeHtml(variant)}</small>` : ''}
              ${sku}
            </span>
          </td>
          <td class="invoice-number">${item.quantity}</td>
          <td class="invoice-number">${formatBdt(item.unitPrice)}</td>
          <td class="invoice-number invoice-number--strong">${formatBdt(item.lineTotal)}</td>
        </tr>`
    })
    .join('')
  return `
    <section class="invoice-items invoice-panel ${rowClass}" aria-labelledby="invoice-items-title">
      <h2 id="invoice-items-title" class="sr-only">Invoice items</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Qty</th>
            <th scope="col">Unit price</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td class="invoice-items__empty" colspan="4">No items added</td></tr>'}
        </tbody>
      </table>
    </section>`
}

function summaryRow(label: string, value: string, className = ''): string {
  return `
    <div${className ? ` class="${className}"` : ''}>
      <dt>${escapeHtml(label)}</dt>
      <dd>${value}</dd>
    </div>`
}

export function InvoiceSummary({ model }: Pick<InvoiceDocumentProps, 'model'>): string {
  const rows: string[] = [
    summaryRow('Subtotal', formatBdt(model.subtotal)),
    summaryRow('Shipping', formatBdt(model.deliveryCharge)),
  ]

  if (model.discount > 0) {
    const discountLabel = model.couponCode ? `Discount (${model.couponCode})` : 'Discount'
    rows.push(summaryRow(discountLabel, `- ${formatBdt(model.discount)}`))
  } else {
    rows.push(summaryRow('Discount', `- ${formatBdt(0)}`))
  }

  const showPartial =
    model.advancePaid > 0 && model.dueAmount > 0 && model.dueAmount !== model.grandTotal

  rows.push(`<div class="invoice-summary__divider" aria-hidden="true"><span></span></div>`)

  if (showPartial) {
    rows.push(summaryRow('Amount paid', formatBdt(model.advancePaid)))
    rows.push(summaryRow('Amount due', formatBdt(model.dueAmount), 'invoice-summary__total'))
  } else {
    if (model.advancePaid > 0) {
      rows.push(summaryRow('Amount paid', formatBdt(model.advancePaid)))
    }
    rows.push(summaryRow('Total', formatBdt(model.grandTotal), 'invoice-summary__total'))
  }

  return `
    <section class="invoice-closing" aria-label="Invoice summary">
      <div class="invoice-thanks invoice-panel">
        <p class="invoice-thanks__title">Thank you</p>
        <p>for your trust and continued support.</p>
      </div>

      <dl class="invoice-summary invoice-panel">
        ${rows.join('')}
      </dl>
    </section>`
}

export function InvoiceFooter({ model }: Pick<InvoiceDocumentProps, 'model'>): string {
  const phone = model.brand.phoneE164.replace(/^\+/, '')
  const email = model.brand.email || 'info@splaro.co'
  const items = [
    { icon: 'pin' as const, text: model.brand.office },
    { icon: 'web' as const, text: model.brand.websiteDisplay },
    { icon: 'phone' as const, text: phone ? `+${phone}` : '' },
    { icon: 'mail' as const, text: email },
  ].filter((item) => item.text)

  return `
    <footer class="invoice-footer">
      <address>
        ${items
          .map(
            (item) => `
          <span class="invoice-footer__item">
            <span class="invoice-footer__icon">${footerIcon(item.icon)}</span>
            ${escapeHtml(item.text)}
          </span>`,
          )
          .join('')}
      </address>
    </footer>`
}

export function InvoiceDocument({ model, logoUrl }: InvoiceDocumentProps): string {
  return `
    <article class="invoice-document">
      <div class="invoice-document__leather" aria-hidden="true"></div>
      <div class="invoice-document__light" aria-hidden="true"></div>
      <div class="invoice-document__stitch invoice-document__stitch--outer" aria-hidden="true"></div>
      <div class="invoice-document__stitch invoice-document__stitch--inner" aria-hidden="true"></div>
      <svg class="invoice-edge-ribbon invoice-edge-ribbon--top" viewBox="0 0 420 150" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-12 18C70 0 88 110 196 92C292 76 316 22 436 38"/>
        <path d="M-16 32C62 15 92 126 205 106C302 89 329 37 440 53"/>
      </svg>
      <svg class="invoice-edge-ribbon invoice-edge-ribbon--bottom" viewBox="0 0 420 150" preserveAspectRatio="none" aria-hidden="true">
        <path d="M432 132C350 150 332 40 224 58C128 74 104 128 -16 112"/>
        <path d="M436 118C358 135 328 24 215 44C118 61 91 113 -20 97"/>
      </svg>
      <div class="invoice-document__content">
        ${InvoiceHeader({ model, logoUrl })}
        ${InvoiceMeta({ model })}
        ${InvoiceItemsTable({ model })}
        ${InvoiceSummary({ model })}
        ${InvoiceFooter({ model })}
      </div>
    </article>`
}
