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
] as const

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number]

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
]

export const DEFAULT_LEGAL_PAGES: Record<LegalPageSlug, LegalPageContent> = {
  privacy: {
    title: 'Privacy Policy',
    description:
      'How SPLARO collects, uses, and protects your personal information when you shop with us in Bangladesh.',
    sections: [
      {
        heading: 'Overview',
        body: 'SPLARO ("we", "our", "us") operates splaro.co and related channels. This Privacy Policy explains how we handle your data when you browse, purchase, or contact us. By using our services, you agree to the practices described here.',
      },
      {
        heading: 'Information we collect',
        body: 'We collect information you provide directly — name, phone number, email, delivery address, order history, and payment method selection. We also collect technical data such as device type, browser, IP address, and cookies to improve site performance and security.',
      },
      {
        heading: 'How we use your information',
        body: 'Your data helps us process orders, arrange courier delivery across Bangladesh, send order updates via SMS or WhatsApp, prevent fraud, and improve product recommendations. With your consent, we may send promotional offers about new collections and loyalty rewards.',
      },
      {
        heading: 'Payment data',
        body: 'SPLARO does not store full mobile banking credentials. Payments via bKash, Nagad, or card are processed through licensed payment partners. We retain transaction references and amounts for accounting and dispute resolution as required by Bangladeshi law.',
      },
      {
        heading: 'Sharing with third parties',
        body: 'We share delivery details with courier partners (e.g. Pathao, RedX, Steadfast) solely to fulfil your order. Analytics providers may receive anonymised usage data. We never sell your personal information to third parties for marketing.',
      },
      {
        heading: 'Data retention & security',
        body: 'Order records are retained for at least five years for tax and legal compliance. We use SSL encryption, access controls, and regular security reviews. You may request deletion of marketing preferences at any time.',
      },
      {
        heading: 'Your rights',
        body: 'You may request access, correction, or deletion of personal data by emailing support@splaro.co. We respond within 15 business days. You may opt out of promotional messages via the unsubscribe link or by replying STOP to SMS.',
      },
      {
        heading: 'Contact',
        body: 'For privacy questions, contact SPLARO Customer Care at support@splaro.co or 09666-774577, Sector 13, Road 12, Uttara, Dhaka 1230, Bangladesh.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    description: 'The terms governing your use of SPLARO website, purchases, and services in Bangladesh.',
    sections: [
      {
        heading: 'Agreement',
        body: 'These Terms & Conditions apply to all visitors and customers of SPLARO. By placing an order or creating an account, you confirm that you are at least 18 years old or have guardian consent, and that information you provide is accurate.',
      },
      {
        heading: 'Products & pricing',
        body: 'All prices are listed in Bangladeshi Taka (BDT) inclusive of applicable VAT where stated. Product images are representative; minor colour variation may occur due to screen settings. SPLARO reserves the right to correct pricing errors and cancel orders affected by such errors.',
      },
      {
        heading: 'Orders & acceptance',
        body: 'An order confirmation email or SMS does not guarantee acceptance until stock is verified. SPLARO may cancel orders due to stock unavailability, suspected fraud, or delivery restrictions. Refunds for cancelled prepaid orders are processed within 7–10 business days.',
      },
      {
        heading: 'Account responsibility',
        body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately if you suspect unauthorised access.',
      },
      {
        heading: 'Intellectual property',
        body: 'All SPLARO branding, photography, copy, and design assets are protected by copyright. You may not reproduce, scrape, or resell SPLARO content without written permission.',
      },
      {
        heading: 'Limitation of liability',
        body: 'SPLARO is not liable for indirect or consequential damages arising from use of the site or delayed delivery caused by events outside our reasonable control, including natural disasters, courier strikes, or government restrictions.',
      },
      {
        heading: 'Governing law',
        body: "These terms are governed by the laws of the People's Republic of Bangladesh. Disputes shall first be addressed through SPLARO Customer Care; unresolved matters may be referred to courts in Dhaka.",
      },
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    description: 'Delivery timelines, charges, and coverage for SPLARO orders across Bangladesh.',
    sections: [
      {
        heading: 'Delivery coverage',
        body: 'SPLARO delivers nationwide across Bangladesh including Dhaka, Chattogram, Sylhet, Rajshahi, Khulna, Barishal, Rangpur, and Mymensingh divisions. Remote areas may require an additional 1–2 business days.',
      },
      {
        heading: 'Processing time',
        body: 'Orders are processed within 24 hours on business days (Saturday–Thursday). Orders placed after 4:00 PM or on Fridays/public holidays ship the next business day.',
      },
      {
        heading: 'Dhaka metro delivery',
        body: 'Inside Dhaka city limits, standard delivery takes 1–2 business days. Express same-day delivery is available in select zones for orders confirmed before 12:00 PM, subject to courier availability.',
      },
      {
        heading: 'Outside Dhaka',
        body: 'Nationwide delivery typically takes 2–4 business days depending on destination. You will receive SMS and WhatsApp updates with tracking links once your parcel is handed to our courier partner.',
      },
      {
        heading: 'Delivery charges',
        body: 'Standard delivery fee is BDT 120 for orders below BDT 5,000. Orders of BDT 5,000 or more qualify for free standard delivery. Express delivery incurs an additional BDT 150 where available.',
      },
      {
        heading: 'Cash on Delivery (COD)',
        body: 'COD is available in most service areas. A small verification call may be placed before dispatch. Repeated COD refusals may result in account restrictions.',
      },
      {
        heading: 'Undelivered parcels',
        body: 'If a delivery attempt fails due to incorrect address or unavailability, our team will contact you to reschedule. Parcels unclaimed after three attempts may be returned to SPLARO and refunded minus delivery charges.',
      },
    ],
  },
  returns: {
    title: 'Returns & Exchange Policy',
    description: 'How to return or exchange SPLARO items within Bangladesh.',
    sections: [
      {
        heading: 'Return window',
        body: 'Unworn items with original tags and packaging may be returned or exchanged within 7 days of delivery. Sale items marked "Final Sale" are not eligible unless defective.',
      },
      {
        heading: 'Eligible conditions',
        body: 'Items must be unworn, unwashed, and free from perfume, stains, or damage. Footwear must include the original box. Swimwear and innerwear are non-returnable for hygiene reasons unless faulty.',
      },
      {
        heading: 'How to initiate a return',
        body: 'Email support@splaro.co or message us on WhatsApp with your order number, item name, and reason. Our team will provide a return authorisation and pickup or drop-off instructions within 1 business day.',
      },
      {
        heading: 'Exchanges',
        body: 'Size and colour exchanges are subject to stock availability. If your preferred variant is unavailable, we offer a store credit or full refund. Exchange delivery is free for the first exchange per order.',
      },
      {
        heading: 'Refunds',
        body: 'Approved refunds are processed within 7–10 business days to the original payment method. bKash and Nagad refunds are sent to the number used at checkout. COD orders receive refund via bKash or bank transfer.',
      },
      {
        heading: 'Defective items',
        body: 'If you receive a defective or wrong item, contact us within 48 hours with photos. SPLARO covers return shipping and offers a replacement or full refund at no extra cost.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    description: 'Reach SPLARO Customer Care by phone, email, WhatsApp, or visit our Uttara studio.',
    sections: [
      {
        heading: 'Customer Care hours',
        body: 'Saturday – Thursday, 10:00 AM – 8:00 PM (BST). Friday: 2:00 PM – 8:00 PM. We respond to emails and WhatsApp messages within 4 business hours.',
      },
      {
        heading: 'Studio address',
        body: 'SPLARO Flagship Studio, Sector 13, Road 12, Uttara, Dhaka 1230, Bangladesh. Walk-ins welcome during store hours. Parking available on Road 12.',
      },
      {
        heading: 'Order support',
        body: 'For order tracking, delivery updates, or payment issues, have your order number ready (format SPL-YYYY-XXXXX). You can also track orders at splaro.co/track-order.',
      },
    ],
  },
  'size-guide': {
    title: 'Size Guide',
    description: 'Find your perfect SPLARO fit with our measurement charts for Women, Men, and Kids.',
    sections: [
      {
        heading: 'How to measure',
        body: 'Use a soft measuring tape over light clothing. Chest/Bust: measure around the fullest part. Waist: measure at natural waistline. Hip: measure around the fullest part. For footwear, measure foot length from heel to longest toe while standing.',
      },
      {
        heading: 'Fit notes',
        body: "SPLARO fits true to size unless noted on the product page. Relaxed and oversized styles intentionally run larger — check the product description. Between sizes? We recommend sizing up for comfort in Bangladesh's warm climate.",
      },
      {
        heading: 'Still unsure?',
        body: 'Message us on WhatsApp with your measurements and the product you are interested in. Our stylists will recommend the best size within a few hours.',
      },
    ],
  },
  'gift-card-policy': {
    title: 'Gift Card Policy',
    description: 'Terms for SPLARO digital and physical gift cards in Bangladesh.',
    sections: [
      {
        heading: 'Gift card types',
        body: 'SPLARO offers digital gift cards delivered by email/SMS and physical gift cards available at our Uttara studio. Denominations range from BDT 1,000 to BDT 20,000.',
      },
      {
        heading: 'Redemption',
        body: 'Enter your gift card code at checkout. Gift cards can be used for full or partial payment. Remaining balance stays on the card for future purchases. Gift cards cannot be redeemed for cash.',
      },
      {
        heading: 'Validity',
        body: 'Gift cards are valid for 12 months from the date of purchase. Expired cards cannot be extended except where required by law.',
      },
      {
        heading: 'Lost or stolen cards',
        body: 'Treat your gift card code like cash. SPLARO is not responsible for lost, stolen, or unauthorised use of gift card codes. Contact support immediately if you suspect misuse.',
      },
      {
        heading: 'Returns paid with gift cards',
        body: 'Refunds for orders paid with gift cards are issued as store credit to a new gift card code. Cash refunds are not available for gift card purchases.',
      },
    ],
  },
  about: {
    title: 'About SPLARO',
    description: 'Premium everyday fashion designed in Dhaka for modern Bangladesh.',
    sections: [
      {
        heading: 'Our story',
        body: "SPLARO was founded in Dhaka with a simple belief: everyday clothing should feel premium, last longer, and suit Bangladesh's climate. From breathable summer edits to structured workwear, we design pieces that move with you — from Uttara mornings to Gulshan evenings.",
      },
      {
        heading: 'Design philosophy',
        body: 'We favour clean lines, thoughtful fabrics, and restrained colour palettes. Each collection is developed in-house with local artisans and international fabric partners. Every garment is fit-tested on Bangladeshi body types before production.',
      },
      {
        heading: 'Sustainability',
        body: 'We produce in limited runs to reduce waste. Packaging uses recycled materials where possible. We are working toward full traceability of our cotton and linen supply chains by 2027.',
      },
      {
        heading: 'Community',
        body: 'SPLARO supports local tailoring apprenticeships in Dhaka and partners with courier services that employ riders across Bangladesh. Follow @splaro.official for behind-the-scenes content and styling tips.',
      },
      {
        heading: 'Visit us',
        body: 'Experience SPLARO in person at our Uttara studio — Sector 13, Road 12, Dhaka 1230. Open Saturday–Thursday, 10:00 AM – 8:00 PM.',
      },
    ],
  },
  editorial: {
    title: 'SPLARO Journal',
    description: 'Editorial stories on style, culture, and everyday life in Bangladesh.',
    sections: [
      {
        heading: 'Summer in Dhaka',
        body: 'Light linen, relaxed silhouettes, and breathable layers define our Summer Edition. Discover how SPLARO customers style overshirts from office to iftar gatherings.',
      },
      {
        heading: 'The minimal wardrobe',
        body: 'Five SPLARO pieces, fifteen outfits. Our editorial team builds capsule wardrobes for Dhaka professionals who value quality over quantity.',
      },
      {
        heading: 'Fabric notes',
        body: "From Egyptian cotton to washed twill — we break down the materials behind our bestsellers and how to care for them in Bangladesh's humidity.",
      },
      {
        heading: 'Contributors',
        body: 'The SPLARO Journal features photographers, stylists, and writers from across Bangladesh. Interested in collaborating? Email editorial@splaro.co with your portfolio.',
      },
    ],
  },
  loyalty: {
    title: 'SPLARO Loyalty Program',
    description: 'Earn rewards every time you shop with SPLARO in Bangladesh.',
    sections: [
      {
        heading: 'How it works',
        body: 'Join free with your SPLARO account. Earn 1 point for every BDT 100 spent. Points appear in your account within 24 hours of delivery confirmation.',
      },
      {
        heading: 'Tiers',
        body: 'Member (0–4,999 lifetime points): early access to sales. Gold (5,000+ points): birthday gift, free standard delivery on all orders. Platinum (15,000+ points): priority support, exclusive previews, and double points during launch weeks.',
      },
      {
        heading: 'Redeeming points',
        body: '100 points = BDT 100 off your next order. Redeem at checkout in increments of 100 points. Points expire 12 months after earning unless you maintain Gold or Platinum status.',
      },
      {
        heading: 'Refer a friend',
        body: 'Share your referral link from your account dashboard. When a friend completes their first order, you both receive BDT 500 off your next purchase.',
      },
      {
        heading: 'Terms',
        body: 'Points have no cash value and cannot be transferred. SPLARO may adjust the programme with 30 days notice. Returns deduct points earned on returned items.',
      },
    ],
  },
  'payment-policy': {
    title: 'Payment Policy',
    description: 'Accepted payment methods and security practices at SPLARO Bangladesh.',
    sections: [
      {
        heading: 'Accepted methods',
        body: 'SPLARO accepts Cash on Delivery (COD), bKash, Nagad, Visa, Mastercard, and SPLARO Gift Cards. Digital payments may qualify for a 5% checkout discount during promotional periods.',
      },
      {
        heading: 'Cash on Delivery',
        body: 'Pay the courier in cash when your order arrives. Please keep exact change where possible. COD is available for orders up to BDT 25,000 in most areas.',
      },
      {
        heading: 'Mobile banking',
        body: "After selecting bKash or Nagad at checkout, follow the on-screen instructions to complete payment to SPLARO's merchant account. Orders are confirmed once payment is verified — usually within 15 minutes.",
      },
      {
        heading: 'Card payments',
        body: 'Card transactions are processed through PCI-DSS compliant payment gateways. SPLARO does not store full card numbers. 3-D Secure authentication may be required for your bank.',
      },
      {
        heading: 'Failed payments',
        body: 'If a digital payment fails but funds are deducted, contact your provider first, then email support@splaro.co with transaction ID. We will release or confirm your order once verified.',
      },
      {
        heading: 'Invoices',
        body: 'A VAT invoice is included with every delivery and available for download from your account. Business purchases requiring additional documentation may request a formal invoice via email.',
      },
    ],
  },
}
