#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { generateInvoiceHtml, sampleInvoice } from './generate.js'
import type { InvoiceTemplateKind } from './types.js'

const args = process.argv.slice(2)
const isSample = args.includes('--sample')
const templateArg = args.find((a) => a.startsWith('--template='))
const outArg = args.find((a) => a.startsWith('--out='))
const inputArg = args.find((a) => a.startsWith('--input='))

const template = (templateArg?.split('=')[1] ?? 'a4') as InvoiceTemplateKind
const outDir = join(process.cwd(), 'dist', 'output')

async function main() {
  let input = sampleInvoice

  if (inputArg) {
    const path = inputArg.split('=')[1]
    if (!path) throw new Error('Missing --input=path.json')
    const raw = await import(path, { assert: { type: 'json' } })
    input = raw.default as typeof sampleInvoice
  }

  if (!isSample && !inputArg) {
    console.log(`SPLARO Invoice Generator

Usage:
  pnpm test                              Generate sample A4 invoice
  pnpm generate --sample                 Same as test
  pnpm generate --template=receipt       80mm receipt
  pnpm generate --template=label         Shipping label
  pnpm generate --input=order.json       Custom order JSON
  pnpm generate --out=./my-invoice.html  Custom output path
`)
    return
  }

  const html = generateInvoiceHtml(input, {
    template,
    showToolbar: true,
    autoPrint: false,
  })

  const filename =
    template === 'a4'
      ? `invoice-${input.invoiceNumber}.html`
      : template === 'receipt'
        ? `receipt-${input.invoiceNumber}.html`
        : `label-${input.invoiceNumber}.html`

  const outPath = outArg?.split('=')[1] ?? join(outDir, filename)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html, 'utf8')
  console.log(`✓ Generated ${template} invoice → ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
