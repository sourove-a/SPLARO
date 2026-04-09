/**
 * SPLARO — English Translation System
 * All user-facing strings in English.
 */

export type Language = 'EN';

export const translations = {
  /* ── Navbar ── */
  'nav.home':          { EN: 'Home' },
  'nav.all':           { EN: 'All Products' },
  'nav.shoes':         { EN: 'Shoes' },
  'nav.newArrivals':   { EN: 'New Arrivals' },
  'nav.story':         { EN: 'Brand Story' },
  'nav.support':       { EN: 'Support' },
  'nav.account':       { EN: 'My Account' },
  'nav.signIn':        { EN: 'Sign In' },
  'nav.signUp':        { EN: 'Sign Up' },
  'nav.admin':         { EN: 'Admin Panel' },
  'nav.search':        { EN: 'Search shoes, brands...' },
  'nav.searchHint':    { EN: 'Press Enter to Search · Type Brand, Category or Style' },
  'nav.navigate':      { EN: 'Navigate' },
  'nav.profile':       { EN: 'Profile' },
  'nav.cart':          { EN: 'Cart' },
  'nav.search_label':  { EN: 'Search' },
  'nav.trust':         { EN: 'Premium Quality · Authentic Imports · Bangladesh' },

  /* ── Home Page ── */
  'home.headline1':    { EN: 'PREMIUM' },
  'home.headline2':    { EN: 'COLLECTION.' },
  'home.subheadline':  { EN: 'Directly imported footwear with refined craftsmanship, premium materials, and elegant character.' },
  'home.explore':      { EN: 'Explore Collection' },
  'home.newLabel':     { EN: 'NEW' },
  'home.saleLabel':    { EN: 'SALE' },
  'home.featuredBrands': { EN: 'Featured Brands' },
  'home.trending':     { EN: 'Trending Now' },
  'home.viewAll':      { EN: 'View All' },
  'home.shopNow':      { EN: 'Shop Now' },
  'home.freeDelivery': { EN: 'Free delivery on orders above ৳2,500' },

  /* ── About Us ── */
  'about.tag':         { EN: 'About Us' },
  'about.tagBN':       { EN: 'About Us' },
  'about.title1':      { EN: 'SPLARO' },
  'about.title2':      { EN: 'LUXURY.' },
  'about.body1':       { EN: 'Splaro is Bangladesh\'s premium destination for directly imported luxury footwear. We source the finest pieces from global markets — Nike, Adidas, Jordan, Gucci, Louis Vuitton and more — and bring them straight to you without middlemen.' },
  'about.body2':       { EN: 'Every product undergoes rigorous authenticity verification before reaching your hands. Luxury made accessible — shipped straight to your door across Bangladesh.' },
  'about.stat1':       { EN: '500+ Products' },
  'about.stat1sub':    { EN: 'Premium Products' },
  'about.stat2':       { EN: '100% Authentic' },
  'about.stat2sub':    { EN: 'Authentic Imports' },
  'about.stat3':       { EN: '24/7 Support' },
  'about.stat3sub':    { EN: 'Customer Support' },
  'about.feat1t':      { EN: 'Authentic Products' },
  'about.feat1d':      { EN: 'Every item is verified and directly sourced from authorized global suppliers.' },
  'about.feat2t':      { EN: 'Fast Delivery' },
  'about.feat2d':      { EN: 'Delivered safely across Bangladesh with real-time order tracking.' },
  'about.feat3t':      { EN: 'Secure Payment' },
  'about.feat3d':      { EN: 'Multiple secure payment options including bKash, Nagad, and COD.' },
  'about.feat4t':      { EN: 'Easy Returns' },
  'about.feat4d':      { EN: 'Hassle-free returns and exchanges within the return window.' },

  /* ── Shop / Filters ── */
  'shop.allProducts':  { EN: 'All Products' },
  'shop.filterBrand':  { EN: 'Brand' },
  'shop.filterSize':   { EN: 'Size' },
  'shop.filterColor':  { EN: 'Color' },
  'shop.filterPrice':  { EN: 'Price' },
  'shop.filterType':   { EN: 'Type' },
  'shop.sort':         { EN: 'Sort by' },
  'shop.sortPrice':    { EN: 'Price' },
  'shop.sortNew':      { EN: 'Newest' },
  'shop.noProducts':   { EN: 'No products found' },
  'shop.addToCart':    { EN: 'Add to Cart' },
  'shop.viewDetails':  { EN: 'View Details' },
  'shop.inStock':      { EN: 'In Stock' },
  'shop.outOfStock':   { EN: 'Out of Stock' },

  /* ── Product Detail ── */
  'product.size':      { EN: 'Select Size' },
  'product.color':     { EN: 'Color' },
  'product.addCart':   { EN: 'Add to Cart' },
  'product.buyNow':    { EN: 'Buy Now' },
  'product.desc':      { EN: 'Description' },
  'product.brand':     { EN: 'Brand' },
  'product.sku':       { EN: 'SKU' },
  'product.auth':      { EN: '100% Authentic' },
  'product.freeRet':   { EN: 'Free Returns' },
  'product.secure':    { EN: 'Secure Payment' },

  /* ── Cart ── */
  'cart.title':        { EN: 'Your Cart' },
  'cart.empty':        { EN: 'YOUR CART IS EMPTY' },
  'cart.emptyDiscover': { EN: 'Discover elite boutique footwear' },
  'cart.startShopping': { EN: 'Start Shopping' },
  'cart.items':        { EN: 'Selected items' },
  'cart.subtotal':     { EN: 'Subtotal' },
  'cart.shipping':     { EN: 'Shipping' },
  'cart.shippingCalc': { EN: 'Calculated at checkout' },
  'cart.total':        { EN: 'Total' },
  'cart.proceedBilling': { EN: 'Proceed to Billing' },
  'cart.secureCheckout': { EN: 'Secure Checkout' },
  'cart.support':      { EN: 'Customer Support' },
  'cart.checkout':     { EN: 'Proceed to Checkout' },
  'cart.continue':     { EN: 'Continue Shopping' },
  'cart.remove':       { EN: 'Remove' },
  'cart.qty':          { EN: 'Quantity' },
  'cart.size':         { EN: 'Size' },
  'cart.color':        { EN: 'Color' },

  /* ── Shop Filters ── */
  'shop.filters':      { EN: 'Filters' },
  'shop.hideFilters':  { EN: 'Hide Filters' },
  'shop.close':        { EN: 'Close' },
  'shop.category':     { EN: 'Category' },
  'shop.clearFilters': { EN: 'Clear Filters' },
  'shop.adjustFilters': { EN: 'Try adjusting your filters' },

  /* ── Product Card ── */
  'product.curatedImport': { EN: 'Curated Import' },
  'product.delivery710': { EN: 'Delivery: 7-10 Days' },
  'product.unavailable': { EN: 'Currently unavailable' },
  'product.limitedStock': { EN: 'Limited stock' },

  /* ── Checkout ── */
  'checkout.title':    { EN: 'Checkout' },
  'checkout.name':     { EN: 'Full Name' },
  'checkout.phone':    { EN: 'Phone Number' },
  'checkout.address':  { EN: 'Delivery Address' },
  'checkout.district': { EN: 'District' },
  'checkout.payment':  { EN: 'Payment Method' },
  'checkout.cod':      { EN: 'Cash on Delivery' },
  'checkout.bkash':    { EN: 'bKash' },
  'checkout.nagad':    { EN: 'Nagad' },
  'checkout.place':    { EN: 'Place Order' },
  'checkout.summary':  { EN: 'Order Summary' },

  /* ── Order Success ── */
  'success.title':     { EN: 'ORDER CONFIRMED' },
  'success.sub':       { EN: 'Your order is being prepared' },
  'success.orderSummary': { EN: 'Order Summary' },
  'success.orderId':   { EN: 'Order ID' },
  'success.customer':  { EN: 'Customer Name' },
  'success.address':   { EN: 'Delivery Address' },
  'success.total':     { EN: 'Total Amount' },
  'success.status':    { EN: 'Order Status' },
  'success.step1':     { EN: 'Confirmed' },
  'success.step2':     { EN: 'Processing' },
  'success.step3':     { EN: 'Delivery' },
  'success.returnHome': { EN: 'Return Home' },
  'success.discoverMore': { EN: 'Discover More' },

  /* ── Support ── */
  'support.title1':    { EN: 'CUSTOMER' },
  'support.title2':    { EN: 'SUPPORT.' },
  'support.track':     { EN: 'Order Tracking' },
  'support.trackDesc': { EN: 'Track your order status and delivery updates in real-time.' },
  'support.care':      { EN: 'Customer Care' },
  'support.careDesc':  { EN: 'Reach our support team quickly via WhatsApp or email for any queries.' },
  'support.quality':   { EN: 'Quality Guarantee' },
  'support.qualityDesc': { EN: 'All products are 100% authentic, imported directly from verified global suppliers.' },
  'support.whatsapp':  { EN: 'Chat on WhatsApp' },
  'support.email':     { EN: 'Send Email' },
  'support.phone':     { EN: 'Call Us' },

  /* ── Auth ── */
  'auth.login':        { EN: 'Sign In' },
  'auth.signup':       { EN: 'Create Account' },
  'auth.email':        { EN: 'Email Address' },
  'auth.password':     { EN: 'Password' },
  'auth.name':         { EN: 'Full Name' },
  'auth.forgotPass':   { EN: 'Forgot Password?' },
  'auth.noAccount':    { EN: 'Don\'t have an account?' },
  'auth.haveAccount':  { EN: 'Already have an account?' },

  /* ── Footer ── */
  'footer.tagline':    { EN: 'Directly imported premium footwear from global markets to Bangladesh. Unmatched quality, refined taste.' },
  'footer.office':     { EN: 'Head Office' },
  'footer.contact':    { EN: 'Contact' },
  'footer.collection': { EN: 'Collection' },
  'footer.support':    { EN: 'Support' },
  'footer.allProducts': { EN: 'All Products' },
  'footer.shoes':      { EN: 'Shoes' },
  'footer.tracking':   { EN: 'Order Tracking' },
  'footer.about':      { EN: 'About Splaro' },
  'footer.privacy':    { EN: 'Privacy Policy' },
  'footer.terms':      { EN: 'Terms & Conditions' },
  'footer.refund':     { EN: 'Refund Policy' },
  'footer.secured':    { EN: 'Secured by Hostinger' },
  'footer.imported':   { EN: 'Directly imported' },
  'footer.grade':      { EN: 'Premium Grade · Bangladesh' },

  /* ── Trust Badges ── */
  'trust.ssl':         { EN: 'SSL Secured' },
  'trust.sslSub':      { EN: 'Encrypted connection' },
  'trust.auth':        { EN: '100% Authentic' },
  'trust.authSub':     { EN: 'Verified products' },
  'trust.payment':     { EN: 'Safe Payment' },
  'trust.paymentSub':  { EN: 'bKash · Nagad · COD' },
  'trust.delivery':    { EN: 'Fast Delivery' },
  'trust.deliverySub': { EN: 'Across Bangladesh' },

  /* ── Story Page ── */
  'story.title1':      { EN: 'BRAND' },
  'story.title2':      { EN: 'STORY.' },
  'story.empty':       { EN: 'No published stories yet.' },

  /* ── Order Tracking ── */
  'tracking.login':    { EN: 'Log In to Track' },
  'tracking.create':   { EN: 'Create Account' },
  'tracking.noOrders': { EN: 'No orders found for your account yet.' },
  'tracking.status':   { EN: 'Status' },
  'tracking.total':    { EN: 'Total' },

  /* ── Why Choose Us (Service Pillars) ── */
  'why.delivery':      { EN: 'Fast Delivery' },
  'why.deliverysub':   { EN: 'Delivered across Bangladesh in 2–4 days' },
  'why.returns':       { EN: 'Easy Returns' },
  'why.returnssub':    { EN: 'Hassle-free returns within the policy window' },
  'why.quality':       { EN: '100% Authentic' },
  'why.qualitysub':    { EN: 'Every product verified before dispatch' },
  'why.support':       { EN: '24/7 Support' },
  'why.supportsub':    { EN: 'WhatsApp & phone support around the clock' },

  /* ── Testimonials ── */
  'testimonial.label': { EN: 'CUSTOMER REVIEWS' },
  'testimonial.title1': { EN: 'WHAT OUR' },
  'testimonial.title2': { EN: 'CLIENTS SAY.' },
  'testimonial.r1':    { EN: 'The Nike Dunks I ordered arrived in perfect condition — exactly as shown. Fastest delivery I\'ve ever seen from an online shop in Bangladesh!' },
  'testimonial.r2':    { EN: 'Absolutely stunning quality. The Gucci shoes are authentic, packaging was premium, and the customer service team was so responsive on WhatsApp.' },
  'testimonial.r3':    { EN: 'Splaro is the real deal. Ordered Adidas Ultraboost — came with original box, tags intact. Will definitely order again. Highly recommended!' },

  /* ── Sale Banner ── */
  'sale.badge':        { EN: 'LIMITED TIME OFFER' },
  'sale.title1':       { EN: 'EXCLUSIVE' },
  'sale.title2':       { EN: 'DEALS.' },
  'sale.sub':          { EN: 'Premium footwear at unbeatable prices. Don\'t miss out on Bangladesh\'s finest luxury deals.' },
  'sale.offLabel':     { EN: 'On Selected Items' },
  'sale.cta':          { EN: 'Shop Sale Now' },

  /* ── Newsletter / WhatsApp Subscribe ── */
  'newsletter.label':  { EN: 'STAY UPDATED' },
  'newsletter.title':  { EN: 'GET EXCLUSIVE OFFERS' },
  'newsletter.sub':    { EN: 'Join our WhatsApp channel and be the first to know about new arrivals, flash sales, and special discounts.' },
  'newsletter.cta':    { EN: 'Join WhatsApp Channel' },
  'newsletter.note':   { EN: 'No spam. Unsubscribe anytime. Only exclusive deals.' },

  /* ── General ── */
  'general.loading':   { EN: 'Loading' },
  'general.search':    { EN: 'Search' },
  'general.close':     { EN: 'Close' },
  'general.save':      { EN: 'Save' },
  'general.password':  { EN: 'Password' },
  'general.cancel':    { EN: 'Cancel' },
  'general.confirm':   { EN: 'Confirm' },
  'general.later':     { EN: 'Later' },
  'general.or':        { EN: 'or' },
  'general.learnMore': { EN: 'Learn More' },
  'general.backHome':  { EN: 'Back to Home' },
} as const;

export type TranslationKey = keyof typeof translations;

/**
 * Get translation for a key and language.
 */
export function t(key: TranslationKey, lang: Language): string {
  const entry = translations[key] as any;
  if (!entry) return key;
  return entry[lang] ?? entry['EN'] ?? key;
}

/**
 * Hook-compatible translator factory.
 */
export function createTranslator(lang: Language) {
  return (key: TranslationKey): string => t(key, lang);
}
