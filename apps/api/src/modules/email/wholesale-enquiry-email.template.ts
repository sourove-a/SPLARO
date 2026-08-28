import {
  renderCalloutBlock,
  renderEmailLayout,
  renderMetaBlock,
  renderNoteBlock,
} from './email-layout.template'

export interface WholesaleEnquiryEmailInput {
  buyerName: string
  referenceCode: string
  companyName?: string | null
  country?: string | null
  tierName?: string | null
  monthlyUnits?: number | null
  productInterest?: string | null
  message?: string | null
  storeName?: string
  storeEmail?: string | null
  storePhone?: string | null
  siteUrl?: string
}

/**
 * The acknowledgement a wholesale buyer gets on submitting the form.
 *
 * The reference code is the whole point: until this existed a buyer submitted
 * an enquiry into silence, with nothing to quote when they followed up and no
 * way to tell a lost enquiry from a slow one.
 */
export function generateWholesaleEnquiryEmail(input: WholesaleEnquiryEmailInput): {
  subject: string
  html: string
  text: string
} {
  const store = input.storeName?.trim() || 'SPLARO'
  const meta: Array<[string, string]> = [['Your reference', input.referenceCode]]
  if (input.companyName?.trim()) meta.push(['Company', input.companyName.trim()])
  if (input.country?.trim()) meta.push(['Country', input.country.trim()])
  if (input.tierName?.trim()) meta.push(['Programme', input.tierName.trim()])
  if (input.monthlyUnits) meta.push(['Volume', `${input.monthlyUnits.toLocaleString('en-IN')} units / month`])
  if (input.productInterest?.trim()) meta.push(['Interest', input.productInterest.trim()])

  const contact = [input.storeEmail?.trim(), input.storePhone?.trim()].filter(Boolean).join(' · ')

  return {
    subject: `We have your wholesale enquiry — ${input.referenceCode}`,
    html: renderEmailLayout({
      eyebrow: 'Wholesale enquiry',
      heading: input.referenceCode,
      intro: `${input.buyerName?.trim() || 'Hello'}, thank you for the enquiry. It is logged with us and a person — not an autoresponder — will come back to you on terms.`,
      preheader: `Your wholesale reference is ${input.referenceCode}`,
      blocks: [
        renderMetaBlock(meta),
        renderCalloutBlock(
          'Quote this reference in any reply and we can pull your enquiry up straight away.',
        ),
        renderNoteBlock('What you told us', input.message?.trim() ?? ''),
      ],
      footnote: contact
        ? `Reply to this email, or reach us at ${contact}.`
        : 'Reply to this email if anything above is wrong.',
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      `We have your wholesale enquiry — ${input.referenceCode}`,
      '',
      `${input.buyerName?.trim() || 'Hello'}, thank you for the enquiry. A person will come back to you on terms.`,
      '',
      `Your reference: ${input.referenceCode}`,
      ...(input.companyName?.trim() ? [`Company: ${input.companyName.trim()}`] : []),
      ...(input.tierName?.trim() ? [`Programme: ${input.tierName.trim()}`] : []),
      ...(input.monthlyUnits ? [`Volume: ${input.monthlyUnits} units / month`] : []),
      '',
      'Quote this reference in any reply and we can pull your enquiry up straight away.',
      ...(contact ? ['', `Reach us at ${contact}.`] : []),
    ].join('\n'),
  }
}
