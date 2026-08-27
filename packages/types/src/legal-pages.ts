export interface LegalPageSection {
  heading: string
  body: string
}

export interface LegalPageContent {
  title: string
  description: string
  sections: LegalPageSection[]
  metaTitle?: string
  metaDescription?: string
}

export const LEGAL_PAGE_SLUGS = [
  'privacy',
  'terms',
  'shipping',
  'returns',
  'contact',
  'size-guide',
  'gift-card-policy',
  'about',
  'editorial',
  'loyalty',
  'payment-policy',
  'faq',
] as const

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number]

/** Public care contacts — keep in sync with storefront Visit-store / settings. */
const CARE_EMAIL = 'info@splaro.co'
const CARE_PHONE = '01905010205'
const STUDIO_ADDRESS = 'House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh'

export const LEGAL_PAGE_CATALOG: { slug: LegalPageSlug; label: string; path: string }[] = [
  { slug: 'terms', label: 'Terms & Conditions', path: '/terms' },
  { slug: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { slug: 'shipping', label: 'Shipping Policy', path: '/shipping' },
  { slug: 'returns', label: 'Returns & Exchange', path: '/returns' },
  { slug: 'payment-policy', label: 'Payment Policy', path: '/payment-policy' },
  { slug: 'gift-card-policy', label: 'Gift Card Policy', path: '/gift-card-policy' },
  { slug: 'size-guide', label: 'Size Guide', path: '/size-guide' },
  { slug: 'contact', label: 'Contact', path: '/contact' },
  { slug: 'about', label: 'About SPLARO', path: '/about' },
  { slug: 'editorial', label: 'Journal / Editorial', path: '/editorial' },
  { slug: 'loyalty', label: 'Loyalty Program', path: '/loyalty' },
  { slug: 'faq', label: 'FAQ', path: '/faq' },
]

/**
 * Fingerprints from the original shipped template. If CMS still contains these,
 * storefront/admin should serve DEFAULT_LEGAL_PAGES instead of the stale copy.
 * Do not match honest lines such as “we do not accept bKash”.
 */
export const STALE_LEGAL_FINGERPRINTS = [
  'Payments via bKash, Nagad, or card',
  'courier partners (e.g. Pathao, RedX, Steadfast)',
  'Standard delivery fee is BDT 120 for orders below BDT 5,000',
  'Orders of BDT 5,000 or more qualify for free standard delivery',
  'Visa, Mastercard, and SPLARO Gift Cards',
  'international fabric partners',
  'cotton and linen supply chains by 2027',
  'supports local tailoring apprenticeships',
  'Swimwear and innerwear are non-returnable',
  'Footwear must include the original box',
  'SPL-YYYY-XXXXX',
  'inclusive of applicable VAT',
  'A VAT invoice is included',
  'bKash and Nagad refunds are sent',
  'We accept Cash on Delivery (COD), bKash, Nagad, and major cards',
  'Cash on Delivery (COD), bKash, Nagad, Visa, Mastercard',
] as const

export function legalPageLooksStale(page: Pick<LegalPageContent, 'description' | 'metaTitle' | 'metaDescription' | 'sections'>): boolean {
  const blob = [
    page.description,
    page.metaTitle ?? '',
    page.metaDescription ?? '',
    ...page.sections.map((section) => `${section.heading} ${section.body}`),
  ]
    .join('\n')
    .toLowerCase()
  return STALE_LEGAL_FINGERPRINTS.some((fingerprint) => blob.includes(fingerprint.toLowerCase()))
}

function page(
  content: LegalPageContent & { metaTitle: string; metaDescription: string },
): LegalPageContent {
  return content
}

export const DEFAULT_LEGAL_PAGES: Record<LegalPageSlug, LegalPageContent> = {
  privacy: page({
    title: 'Privacy Policy',
    description:
      'How SPLARO collects, uses, and protects your information — including Google sign-in and phone numbers — when you shop our quiet-luxury store in Bangladesh.',
    metaTitle: 'Privacy Policy',
    metaDescription:
      'How SPLARO in Dhaka collects and protects your name, phone, Google login, and delivery details for Cash on Delivery orders across Bangladesh.',
    sections: [
      {
        heading: 'Overview',
        body: 'SPLARO (“we”, “our”, “us”) operates splaro.co — quiet luxury fashion designed in Dhaka. This Privacy Policy explains how we handle your data when you browse, create an account, sign in with Google, place a Cash on Delivery order, or contact us. By using our services, you agree to the practices described here.',
      },
      {
        heading: 'Information we collect',
        body: 'We collect information you provide at checkout, in Customer Care, and when you create an account — name, phone number, email, delivery address, and order history. If you sign in with Google, we receive your Google account name, verified email, Google account ID, and optional profile photo. When phone OTP is enabled, we collect the phone number and one-time code you submit. Signed-in customers may also save a wishlist, leave a product review, or join the newsletter. We collect technical data such as device type, browser, IP address, and cookies to keep the site secure and reliable.',
      },
      {
        heading: 'Accounts & Google sign-in',
        body: 'You can shop as a guest or create an account with email and password, phone OTP (when enabled), or Google Sign-In. Passwords are stored as a one-way hash — we cannot read them. Google Sign-In is processed by Google; we store only the identity Google confirms so we can keep you signed in. After Google Sign-In we may ask for a Bangladesh phone number so we can confirm Cash on Delivery orders. Login records may include IP address and device type for fraud prevention.',
      },
      {
        heading: 'How we use your information',
        body: 'Your data lets us confirm Cash on Delivery orders, keep you signed in, book Steadfast dispatch across Bangladesh, send SMS or WhatsApp updates, prevent fraud, and improve the store. With your consent, we may send collection news to the email or phone you gave us, including newsletter signup. We do not run a live loyalty programme and do not share data for unrelated marketing.',
      },
      {
        heading: 'Payment data',
        body: 'Checkout is Cash on Delivery only. We do not collect bKash, Nagad, or card credentials, and we do not store mobile-banking PINs or full card numbers. Order totals and delivery references are kept for accounting and dispute resolution as required by Bangladeshi law.',
      },
      {
        heading: 'Cookies & analytics',
        body: 'We use a session cookie to keep you signed in. When analytics is configured, we may load Google Analytics (with IP anonymisation), Meta Pixel, and Microsoft Clarity so we can understand how the store is used. These tools may set their own cookies. You can block third-party cookies in your browser; Cash on Delivery checkout will still work.',
      },
      {
        heading: 'Sharing with third parties',
        body: 'We share name, phone, and delivery address with Steadfast solely to fulfil your order. If you use Google Sign-In, Google processes that login. Analytics providers (Google, Meta, Microsoft Clarity) may receive usage data when those tools are enabled. SMS and WhatsApp providers receive the phone number needed to send order updates. We never sell your personal information.',
      },
      {
        heading: 'Data retention & security',
        body: 'Order records are retained for at least five years for tax and legal compliance. Account, Google ID, and login records are kept while the account is active and for a reasonable period after closure if needed for disputes. We use SSL encryption, hashed passwords, access controls, and regular security reviews. You may request deletion of marketing preferences or your account at any time.',
      },
      {
        heading: 'Your rights',
        body: `You may request access, correction, or deletion of personal data — including Google login data and phone numbers — by emailing ${CARE_EMAIL}. We respond within 15 business days. You may opt out of promotional messages via the unsubscribe link or by replying STOP to SMS.`,
      },
      {
        heading: 'Contact',
        body: `For privacy questions, email ${CARE_EMAIL} or call ${CARE_PHONE}. Studio: ${STUDIO_ADDRESS}.`,
      },
    ],
  }),
  terms: page({
    title: 'Terms & Conditions',
    description: 'The terms for using splaro.co, placing Cash on Delivery orders, and shopping SPLARO in Bangladesh.',
    metaTitle: 'Terms & Conditions',
    metaDescription:
      'Terms for shopping SPLARO — quiet luxury fashion designed in Dhaka. Cash on Delivery, Steadfast shipping, and Bangladesh law.',
    sections: [
      {
        heading: 'Agreement',
        body: 'These Terms & Conditions apply to all visitors and customers of SPLARO. By placing an order, you confirm that you are at least 18 years old or have guardian consent, and that the information you provide is accurate.',
      },
      {
        heading: 'Products & pricing',
        body: 'All prices are listed in Bangladeshi Taka (BDT). Prices shown are the amount payable — SPLARO does not add VAT at checkout and does not issue VAT invoices. Product images are representative; minor colour variation may occur due to screen settings. SPLARO reserves the right to correct pricing errors and cancel orders affected by such errors.',
      },
      {
        heading: 'Orders & acceptance',
        body: 'An order confirmation SMS or call does not guarantee acceptance until stock is verified. Payment is Cash on Delivery: you pay the Steadfast courier when the parcel arrives. SPLARO may cancel orders due to stock unavailability, suspected fraud, or delivery restrictions. Cancelled orders that were never collected at the door do not require a refund.',
      },
      {
        heading: 'Account responsibility',
        body: 'If you create an account, you are responsible for keeping credentials confidential and for activity under that account. Notify us immediately if you suspect unauthorised access. Guest checkout is also available.',
      },
      {
        heading: 'Intellectual property',
        body: 'All SPLARO branding, photography, copy, and design assets are protected by copyright. You may not reproduce, scrape, or resell SPLARO content without written permission.',
      },
      {
        heading: 'Limitation of liability',
        body: 'SPLARO is not liable for indirect or consequential damages arising from use of the site or delayed delivery caused by events outside our reasonable control, including natural disasters, courier disruption, or government restrictions.',
      },
      {
        heading: 'Governing law',
        body: "These terms are governed by the laws of the People's Republic of Bangladesh. Disputes shall first be addressed through SPLARO Customer Care; unresolved matters may be referred to courts in Dhaka.",
      },
    ],
  }),
  shipping: page({
    title: 'Shipping Policy',
    description: 'Steadfast delivery across Bangladesh — ৳60 inside Dhaka, ৳120 outside Dhaka.',
    metaTitle: 'Shipping Policy',
    metaDescription:
      'SPLARO ships with Steadfast: ৳60 inside Dhaka and ৳120 outside Dhaka. No flat nationwide fee and no free-shipping threshold.',
    sections: [
      {
        heading: 'Delivery coverage',
        body: 'SPLARO delivers nationwide across Bangladesh with Steadfast, including Dhaka, Chattogram, Sylhet, Rajshahi, Khulna, Barishal, Rangpur, and Mymensingh divisions. Remote areas may require an extra 1–2 business days.',
      },
      {
        heading: 'Processing time',
        body: 'Orders are processed within 24 hours on business days (Saturday–Thursday). Orders placed after 4:00 PM, on Fridays, or on public holidays ship the next business day.',
      },
      {
        heading: 'Dhaka metro delivery',
        body: 'Inside Dhaka, standard Steadfast delivery takes 1–2 business days after dispatch. Delivery is ৳60. We do not currently offer a paid same-day or express add-on at checkout.',
      },
      {
        heading: 'Outside Dhaka',
        body: 'Outside Dhaka, delivery typically takes 2–5 business days depending on destination. Delivery is ৳120. You will receive SMS or WhatsApp updates with Steadfast tracking once the parcel is handed over.',
      },
      {
        heading: 'Delivery charges',
        body: 'Delivery is ৳60 inside Dhaka and ৳120 outside Dhaka on every order. There is no flat ৳120 nationwide rate and no free delivery over a spend threshold.',
      },
      {
        heading: 'Cash on Delivery (COD)',
        body: 'Every storefront order is Cash on Delivery. A verification call may be placed before dispatch. Repeated COD refusals may result in account restrictions.',
      },
      {
        heading: 'Undelivered parcels',
        body: 'If a Steadfast attempt fails because of an incorrect address or unavailability, our team will contact you to reschedule. Parcels unclaimed after three attempts return to SPLARO. Because payment is collected on delivery, unclaimed parcels are not charged.',
      },
    ],
  }),
  returns: page({
    title: 'Returns & Exchange Policy',
    description: 'How to return or exchange unworn SPLARO garments within Bangladesh.',
    metaTitle: 'Returns & Exchange',
    metaDescription:
      'Return or exchange unworn SPLARO pieces within 7 days of delivery. Tags on, Steadfast pickup, Cash on Delivery orders.',
    sections: [
      {
        heading: 'Return window',
        body: 'Unworn garments with original tags and packaging may be returned or exchanged within 7 days of delivery. Sale items marked “Final Sale” are not eligible unless defective.',
      },
      {
        heading: 'Eligible conditions',
        body: 'Items must be unworn, unwashed, and free from perfume, stains, or damage. This policy covers apparel we currently sell. Hygiene categories we do not stock — such as swimwear or innerwear — are not part of the assortment.',
      },
      {
        heading: 'How to initiate a return',
        body: `Email ${CARE_EMAIL} or message us on WhatsApp with your order number (SPL-####), item name, and reason. Our team will provide a return authorisation and Steadfast pickup or studio drop-off instructions within 1 business day.`,
      },
      {
        heading: 'Exchanges',
        body: 'Size and colour exchanges are subject to stock. If your preferred variant is unavailable, we offer a store credit or a refund arrangement through Customer Care. The first exchange per order does not add a second delivery charge.',
      },
      {
        heading: 'Refunds',
        body: 'Most SPLARO orders are paid in cash to the courier. If you return an item after paying on delivery, Customer Care will arrange a refund or store credit once the garment is inspected — typically within 7–10 business days. We do not refund to bKash, Nagad, or cards because those methods are not used at checkout.',
      },
      {
        heading: 'Defective items',
        body: 'If you receive a defective or wrong item, contact us within 48 hours with photos. SPLARO covers return shipping with Steadfast and offers a replacement or refund at no extra cost.',
      },
    ],
  }),
  contact: page({
    title: 'Contact Us',
    description: 'Reach SPLARO Customer Care by phone, email, WhatsApp, or visit our Uttara studio.',
    metaTitle: 'Contact',
    metaDescription:
      'Contact SPLARO in Uttara, Dhaka. Phone, WhatsApp, and email for Cash on Delivery orders — quote SPL-####. Designed in Dhaka.',
    sections: [
      {
        heading: 'Customer Care hours',
        body: 'Saturday – Thursday, 10:00 AM – 8:00 PM (BST). Friday: 2:00 PM – 8:00 PM. We respond to emails and WhatsApp messages within 4 business hours.',
      },
      {
        heading: 'Studio address',
        body: `SPLARO Flagship Studio — ${STUDIO_ADDRESS}. Walk-ins welcome during store hours. Parking available on Road 12.`,
      },
      {
        heading: 'Order support',
        body: 'For tracking, delivery, or payment questions, have your order number ready (format SPL-####, e.g. SPL-1001). Track at splaro.co/track-order with your checkout phone or order number — no account needed.',
      },
    ],
  }),
  'size-guide': page({
    title: 'Size Guide',
    description: 'Women, men & kids — centimetres, measured for Bangladesh, designed in Dhaka.',
    metaTitle: 'Size Guide',
    metaDescription:
      'SPLARO size guide for women, men, and kids in centimetres. True-to-size apparel, designed in Dhaka. Ask Care if you need a fit recommendation.',
    sections: [
      {
        heading: 'How to measure',
        body: 'Use a soft tape against the body, not over bulky layers. Bust or chest at the fullest point, waist at the natural line, hip at the fullest point. Compare centimetres to the chart on this page. SPLARO pieces are fit for Bangladesh — start with your usual size unless the product note says otherwise.',
      },
      {
        heading: 'Women, men & kids',
        body: 'Charts cover women (XS–XL), men (S–XXL), and kids (2Y–10Y). If you are between sizes, take the larger size for structured shirts and the closer size for soft knits. Customer Care can recommend a size if you share height, weight, and the product name.',
      },
      {
        heading: 'Need a second opinion',
        body: `Message WhatsApp or email ${CARE_EMAIL} with your measurements. You may also try pieces at the Uttara studio during Customer Care hours.`,
      },
    ],
  }),
  'gift-card-policy': page({
    title: 'Gift Card Policy',
    description: 'SPLARO does not currently sell gift cards. This page will be updated before any card is issued.',
    metaTitle: 'Gift Card Policy',
    metaDescription:
      'SPLARO gift cards are not on sale yet. Shop quiet luxury fashion designed in Dhaka with Cash on Delivery nationwide.',
    sections: [
      {
        heading: 'Current status',
        body: 'SPLARO does not currently sell digital or physical gift cards. Checkout is Cash on Delivery only. We will publish denominations, validity, and redemption rules on this page before any gift card is offered.',
      },
      {
        heading: 'If we introduce cards later',
        body: 'Any future gift card will be redeemable only at splaro.co or the Uttara studio, will not be exchangeable for cash, and will follow Bangladesh consumer law. Until then, please do not purchase third-party “SPLARO” codes — they are not issued by us.',
      },
      {
        heading: 'Questions',
        body: `Email ${CARE_EMAIL} or call ${CARE_PHONE} if you were promised a gift card by anyone other than SPLARO Customer Care.`,
      },
    ],
  }),
  about: page({
    title: 'About SPLARO',
    description: 'Quiet luxury fashion designed in Dhaka for modern Bangladesh — Cash on Delivery, nationwide Steadfast care.',
    metaTitle: 'About SPLARO',
    metaDescription:
      'SPLARO is quiet luxury fashion designed in Dhaka. Authentic pieces, Cash on Delivery, and Steadfast delivery across Bangladesh.',
    sections: [
      {
        heading: 'Our story',
        body: 'SPLARO is a Bangladesh-based quiet luxury fashion house. Designed in Dhaka, our pieces are made for the climate and the rhythm of this city — from Uttara mornings to Gulshan evenings. We sell what we actually produce: considered apparel you can wear often, not a catalogue of promises.',
      },
      {
        heading: 'Design philosophy',
        body: 'We favour clean lines, thoughtful cloth, and restrained colour. Collections are developed in Dhaka and fit for Bangladeshi body types, so size charts match real wear. Tagline: Designed in Dhaka.',
      },
      {
        heading: 'How we earn trust',
        body: 'Cash on Delivery across Bangladesh. Unworn returns within 7 days with tags intact. Live Steadfast tracking after dispatch. Customer Care on phone, email, and WhatsApp — Saturday to Thursday, 10:00 AM – 8:00 PM (BST). Studio try-ons welcome in Uttara.',
      },
      {
        heading: 'How we work',
        body: 'We produce in considered runs rather than endless stock. Packaging is kept simple. We do not publish supply-chain timelines we cannot keep, and we do not claim programmes that are not running.',
      },
      {
        heading: 'Visit us',
        body: `Experience SPLARO in person at our Uttara studio — ${STUDIO_ADDRESS}. Open Saturday–Thursday, 10:00 AM – 8:00 PM. Prefer online? Shop with Cash on Delivery nationwide, or message Care before you visit.`,
      },
    ],
  }),
  editorial: page({
    title: 'SPLARO Journal',
    description: 'Quiet notes on style and everyday life in Bangladesh — written for customers who want to know what they wear.',
    metaTitle: 'SPLARO Journal',
    metaDescription:
      'The SPLARO Journal: style notes from Dhaka. Quiet luxury fashion designed in Dhaka — fit, fabric care, and how to wear the collection.',
    sections: [
      {
        heading: 'Summer in Dhaka',
        body: 'Humidity asks for breathable cloth and easy layers. Move from work to evening without changing twice: one overshirt, two tees, one trouser. Designed in Dhaka for this weather, not imported for another climate.',
      },
      {
        heading: 'A smaller wardrobe',
        body: 'Build a Dhaka capsule from pieces you already own and a few SPLARO staples — a structured shirt, a soft knit, a tailored bottom, an easy dress or panjabi. Quality over quantity. Every order ships with our authenticity promise.',
      },
      {
        heading: 'Caring for cloth here',
        body: 'Bangladesh humidity is hard on finish. Hang-dry when you can, avoid high heat on lined pieces, and store shirts on hangers rather than folded wet. Product pages carry fibre notes for each garment we sell.',
      },
      {
        heading: 'Fit & sizing honesty',
        body: 'SPLARO size guides are built for Bangladesh, not copied from a generic EU chart. Unsure? Message Customer Care with your height, weight, and the product name — or visit the Uttara studio to try before you buy.',
      },
      {
        heading: 'Write to us',
        body: `The Journal is written in-house. For press or collaboration, email ${CARE_EMAIL} with a short note — we read everything, and we only commission work we intend to publish.`,
      },
    ],
  }),
  loyalty: page({
    title: 'SPLARO Loyalty Program',
    description: 'A rewards programme is not currently active at SPLARO. This page will be updated before any points are issued.',
    metaTitle: 'Loyalty Program',
    metaDescription:
      'SPLARO loyalty points and tiers are not active. Shop quiet luxury fashion designed in Dhaka with Cash on Delivery.',
    sections: [
      {
        heading: 'Current status',
        body: 'SPLARO does not currently operate a live loyalty, VIP, or referral programme. No points, tiers, or referral credits are being issued on orders.',
      },
      {
        heading: 'When it launches',
        body: 'If we introduce rewards, we will publish earning rates, expiry, and redemption rules here first. Until then, please ignore any unofficial “SPLARO points” offers.',
      },
      {
        heading: 'Shop as usual',
        body: 'Checkout remains Cash on Delivery. Delivery is ৳60 inside Dhaka and ৳120 outside Dhaka with Steadfast. Customer Care is unchanged.',
      },
    ],
  }),
  'payment-policy': page({
    title: 'Payment Policy',
    description: 'SPLARO checkout is Cash on Delivery only — pay the Steadfast courier when your order arrives.',
    metaTitle: 'Payment Policy',
    metaDescription:
      'SPLARO accepts Cash on Delivery only. No bKash, Nagad, Visa, or Mastercard at checkout. Designed in Dhaka, delivered by Steadfast.',
    sections: [
      {
        heading: 'Accepted methods',
        body: 'SPLARO accepts Cash on Delivery (COD) only. We do not currently accept bKash, Nagad, Visa, Mastercard, or other digital wallets at checkout, and we do not sell gift cards.',
      },
      {
        heading: 'Cash on Delivery',
        body: 'Pay the Steadfast courier in cash when your order arrives. Please keep exact change where possible. A short verification call may be placed before dispatch.',
      },
      {
        heading: 'What we do not take',
        body: 'Mobile banking and card checkouts are not enabled. If a site or message asks you to send bKash or Nagad to complete a SPLARO order, it is not from us — contact Customer Care immediately.',
      },
      {
        heading: 'Failed or disputed amounts',
        body: `Because payment happens at the door, most disputes are about a refused parcel or a return after delivery. Email ${CARE_EMAIL} with your order number (SPL-####). We do not collect prepaid digital payments, so we cannot “release” a held bKash or card charge.`,
      },
      {
        heading: 'Invoices',
        body: 'An invoice is included with every delivery and is available from your account when you have one. SPLARO does not issue VAT invoices. Businesses that need extra documentation may request a copy via email.',
      },
    ],
  }),
  faq: page({
    title: 'Frequently Asked Questions',
    description: 'Quick answers about SPLARO orders, Steadfast delivery, Cash on Delivery, returns, and sizing in Bangladesh.',
    metaTitle: 'FAQ',
    metaDescription:
      'SPLARO FAQ: Cash on Delivery, ৳60 Dhaka / ৳120 outside Dhaka with Steadfast, 7-day returns, and SPL-#### order tracking.',
    sections: [
      {
        heading: 'How do I place an order?',
        body: 'Browse the shop, select your size and colour, add items to bag, and proceed to checkout. You can complete Cash on Delivery as a guest or with a free account.',
      },
      {
        heading: 'Which payment methods do you accept?',
        body: 'Cash on Delivery only. Pay the Steadfast courier when the parcel arrives. We do not accept bKash, Nagad, Visa, or Mastercard at checkout.',
      },
      {
        heading: 'How long does delivery take?',
        body: 'Dhaka orders usually arrive in 1–2 business days after dispatch (৳60). Outside Dhaka typically takes 2–5 business days (৳120). You will receive SMS or WhatsApp updates once Steadfast has the parcel. There is no free-shipping threshold.',
      },
      {
        heading: 'How can I track my order?',
        body: 'Use the Track Order page with your phone number or order number (SPL-####, e.g. SPL-1001), or open My Orders in your SPLARO account after signing in.',
      },
      {
        heading: 'What is your return policy?',
        body: 'Unworn garments with tags may be returned or exchanged within 7 days of delivery. See Returns & Exchange for eligibility and how to start a return.',
      },
      {
        heading: 'How does the wishlist work?',
        body: 'Tap the heart icon on any product to save it. Signed-in customers sync wishlists across devices from Account → Wishlist. Guests can save items on the current device until they sign in.',
      },
      {
        heading: 'Do you offer size help?',
        body: 'Yes — see our Size Guide or message Customer Care on WhatsApp with your measurements and the product name. Our team recommends fit for Bangladesh sizing.',
      },
      {
        heading: 'How do I contact support?',
        body: `Email ${CARE_EMAIL}, call ${CARE_PHONE}, or message us on WhatsApp. Hours: Saturday–Thursday 10:00 AM – 8:00 PM (BST).`,
      },
    ],
  }),
}
