/**
 * SPLARO — Bilingual Translation System (EN / BN)
 * All user-facing strings in English and Bengali.
 * Usage: const t = useTranslation(); t('nav.home') → "Home" or "হোম"
 */

export type Language = 'EN' | 'BN';

export const translations = {
  /* ── Navbar ── */
  'nav.home':          { EN: 'Home',          BN: 'হোম' },
  'nav.all':           { EN: 'All Products',  BN: 'সব পণ্য' },
  'nav.shoes':         { EN: 'Shoes',         BN: 'জুতা' },
  'nav.bags':          { EN: 'Bags',          BN: 'ব্যাগ' },
  'nav.newArrivals':   { EN: 'New Arrivals',  BN: 'নতুন পণ্য' },
  'nav.story':         { EN: 'Brand Story',   BN: 'ব্র্যান্ড স্টোরি' },
  'nav.support':       { EN: 'Support',       BN: 'সহায়তা' },
  'nav.account':       { EN: 'My Account',    BN: 'আমার অ্যাকাউন্ট' },
  'nav.signIn':        { EN: 'Sign In',       BN: 'লগইন' },
  'nav.signUp':        { EN: 'Sign Up',       BN: 'নিবন্ধন' },
  'nav.admin':         { EN: 'Admin Panel',   BN: 'অ্যাডমিন প্যানেল' },
  'nav.search':        { EN: 'Search shoes, bags, brands...', BN: 'জুতা, ব্যাগ, ব্র্যান্ড খুঁজুন...' },
  'nav.searchHint':    { EN: 'Press Enter to Search · Type Brand, Category or Style', BN: 'এন্টার চাপুন · ব্র্যান্ড, ক্যাটাগরি বা স্টাইল লিখুন' },
  'nav.navigate':      { EN: 'Navigate',      BN: 'নেভিগেট' },
  'nav.profile':       { EN: 'Profile',       BN: 'প্রোফাইল' },
  'nav.cart':          { EN: 'Cart',          BN: 'কার্ট' },
  'nav.search_label':  { EN: 'Search',        BN: 'খুঁজুন' },
  'nav.trust':         { EN: 'Premium Quality · Authentic Imports · Bangladesh', BN: 'প্রিমিয়াম মান · সত্যিকারের পণ্য · বাংলাদেশ' },

  /* ── Home Page ── */
  'home.headline1':    { EN: 'PREMIUM',       BN: 'প্রিমিয়াম' },
  'home.headline2':    { EN: 'COLLECTION.',   BN: 'কালেকশন।' },
  'home.subheadline':  { EN: 'Directly imported footwear & bags with refined craftsmanship, premium materials, and elegant character.', BN: 'সরাসরি আমদানি করা ফুটওয়্যার ও ব্যাগ — উচ্চমানের উপকরণ ও পরিশীলিত কারুকাজ সহ।' },
  'home.explore':      { EN: 'Explore Collection', BN: 'কালেকশন দেখুন' },
  'home.newLabel':     { EN: 'NEW',           BN: 'নতুন' },
  'home.saleLabel':    { EN: 'SALE',          BN: 'অফার' },
  'home.featuredBrands': { EN: 'Featured Brands', BN: 'বিশেষ ব্র্যান্ড' },
  'home.trending':     { EN: 'Trending Now',  BN: 'এখন ট্রেন্ডিং' },
  'home.viewAll':      { EN: 'View All',      BN: 'সব দেখুন' },
  'home.shopNow':      { EN: 'Shop Now',      BN: 'এখনই কিনুন' },
  'home.freeDelivery': { EN: 'Free delivery on orders above ৳2,500', BN: '৳২,৫০০ এর উপরে অর্ডারে বিনামূল্যে ডেলিভারি' },

  /* ── About Us ── */
  'about.tag':         { EN: 'About Us',      BN: 'আমাদের সম্পর্কে' },
  'about.tagBN':       { EN: 'আমাদের সম্পর্কে · About Us', BN: 'আমাদের সম্পর্কে · About Us' },
  'about.title1':      { EN: 'SPLARO',        BN: 'স্প্লারো' },
  'about.title2':      { EN: 'LUXURY.',       BN: 'লাক্সারি।' },
  'about.body1':       { EN: 'Splaro is Bangladesh\'s premium destination for directly imported luxury footwear and bags. We source the finest pieces from global markets — Nike, Adidas, Jordan, Gucci, Louis Vuitton and more — and bring them straight to you without middlemen.', BN: 'স্প্লারো বাংলাদেশের প্রিমিয়াম ফুটওয়্যার ও ব্যাগের সর্বোচ্চ গন্তব্য। আমরা নাইকি, আডিডাস, জর্ডান, গুচি, লুই ভিটন সহ বিশ্বের সেরা ব্র্যান্ড সরাসরি আমদানি করি।' },
  'about.body2':       { EN: 'Every product undergoes rigorous authenticity verification before reaching your hands. Luxury made accessible — shipped straight to your door across Bangladesh.', BN: 'প্রতিটি পণ্য আপনার কাছে পৌঁছানোর আগে কঠোর সত্যতা যাচাই করা হয়। সারা বাংলাদেশে দরজায় পৌঁছে দিচ্ছি।' },
  'about.stat1':       { EN: '500+ Products', BN: '৫০০+ পণ্য' },
  'about.stat1sub':    { EN: 'Premium Products', BN: 'প্রিমিয়াম পণ্য' },
  'about.stat2':       { EN: '100% Authentic', BN: '১০০% প্রামাণিক' },
  'about.stat2sub':    { EN: 'Authentic Imports', BN: 'সত্যিকারের আমদানি' },
  'about.stat3':       { EN: '24/7 Support', BN: '২৪/৭ সহায়তা' },
  'about.stat3sub':    { EN: 'Customer Support', BN: 'কাস্টমার সাপোর্ট' },
  'about.feat1t':      { EN: 'Authentic Products', BN: 'প্রামাণিক পণ্য' },
  'about.feat1d':      { EN: 'Every item is verified and directly sourced from authorized global suppliers.', BN: 'প্রতিটি পণ্য যাচাইকৃত এবং অনুমোদিত বৈশ্বিক সরবরাহকারীর কাছ থেকে সরাসরি সংগৃহীত।' },
  'about.feat2t':      { EN: 'Fast Delivery', BN: 'দ্রুত ডেলিভারি' },
  'about.feat2d':      { EN: 'Delivered safely across Bangladesh with real-time order tracking.', BN: 'রিয়েল-টাইম ট্র্যাকিং সহ সারা বাংলাদেশে নিরাপদ ডেলিভারি।' },
  'about.feat3t':      { EN: 'Secure Payment', BN: 'নিরাপদ পেমেন্ট' },
  'about.feat3d':      { EN: 'Multiple secure payment options including bKash, Nagad, and COD.', BN: 'বিকাশ, নগদ এবং ক্যাশ অন ডেলিভারি সহ নিরাপদ পেমেন্ট অপশন।' },
  'about.feat4t':      { EN: 'Easy Returns', BN: 'সহজ রিটার্ন' },
  'about.feat4d':      { EN: 'Hassle-free returns and exchanges within the return window.', BN: 'রিটার্ন উইন্ডোর মধ্যে ঝামেলামুক্ত রিটার্ন ও এক্সচেঞ্জ।' },

  /* ── Shop / Filters ── */
  'shop.allProducts':  { EN: 'All Products',  BN: 'সব পণ্য' },
  'shop.filterBrand':  { EN: 'Brand',         BN: 'ব্র্যান্ড' },
  'shop.filterSize':   { EN: 'Size',          BN: 'সাইজ' },
  'shop.filterColor':  { EN: 'Color',         BN: 'রঙ' },
  'shop.filterPrice':  { EN: 'Price',         BN: 'মূল্য' },
  'shop.filterType':   { EN: 'Type',          BN: 'ধরন' },
  'shop.sort':         { EN: 'Sort by',       BN: 'সাজান' },
  'shop.sortPrice':    { EN: 'Price',         BN: 'মূল্য' },
  'shop.sortNew':      { EN: 'Newest',        BN: 'নতুন' },
  'shop.noProducts':   { EN: 'No products found', BN: 'কোনো পণ্য পাওয়া যায়নি' },
  'shop.addToCart':    { EN: 'Add to Cart',   BN: 'কার্টে যোগ করুন' },
  'shop.viewDetails':  { EN: 'View Details',  BN: 'বিস্তারিত দেখুন' },
  'shop.inStock':      { EN: 'In Stock',      BN: 'স্টকে আছে' },
  'shop.outOfStock':   { EN: 'Out of Stock',  BN: 'স্টক শেষ' },

  /* ── Product Detail ── */
  'product.size':      { EN: 'Select Size',   BN: 'সাইজ বেছে নিন' },
  'product.color':     { EN: 'Color',         BN: 'রঙ' },
  'product.addCart':   { EN: 'Add to Cart',   BN: 'কার্টে যোগ করুন' },
  'product.buyNow':    { EN: 'Buy Now',       BN: 'এখনই কিনুন' },
  'product.desc':      { EN: 'Description',   BN: 'বিবরণ' },
  'product.brand':     { EN: 'Brand',         BN: 'ব্র্যান্ড' },
  'product.sku':       { EN: 'SKU',           BN: 'এসকেইউ' },
  'product.auth':      { EN: '100% Authentic', BN: '১০০% প্রামাণিক' },
  'product.freeRet':   { EN: 'Free Returns',  BN: 'বিনামূল্যে রিটার্ন' },
  'product.secure':    { EN: 'Secure Payment', BN: 'নিরাপদ পেমেন্ট' },

  /* ── Cart ── */
  'cart.title':        { EN: 'Your Cart',     BN: 'আপনার কার্ট' },
  'cart.empty':        { EN: 'YOUR CART IS EMPTY', BN: 'আপনার কার্ট খালি' },
  'cart.emptyDiscover': { EN: 'Discover elite boutique footwear & bags', BN: 'এলিট ফুটওয়্যার ও ব্যাগ দেখুন' },
  'cart.startShopping': { EN: 'Start Shopping', BN: 'কেনাকাটা শুরু করুন' },
  'cart.items':        { EN: 'Selected items', BN: 'টি আইটেম নির্বাচিত' },
  'cart.subtotal':     { EN: 'Subtotal',      BN: 'সাবটোটাল' },
  'cart.shipping':     { EN: 'Shipping',      BN: 'শিপিং' },
  'cart.shippingCalc': { EN: 'Calculated at checkout', BN: 'চেকআউটে হিসাব হবে' },
  'cart.total':        { EN: 'Total',         BN: 'মোট' },
  'cart.proceedBilling': { EN: 'Proceed to Billing', BN: 'বিলিং এ যান' },
  'cart.secureCheckout': { EN: 'Secure Checkout', BN: 'নিরাপদ চেকআউট' },
  'cart.support':      { EN: 'Customer Support', BN: 'কাস্টমার সাপোর্ট' },
  'cart.checkout':     { EN: 'Proceed to Checkout', BN: 'চেকআউটে যান' },
  'cart.continue':     { EN: 'Continue Shopping', BN: 'কেনাকাটা চালিয়ে যান' },
  'cart.remove':       { EN: 'Remove',        BN: 'সরান' },
  'cart.qty':          { EN: 'Quantity',      BN: 'পরিমাণ' },
  'cart.size':         { EN: 'Size',          BN: 'সাইজ' },
  'cart.color':        { EN: 'Color',         BN: 'রঙ' },

  /* ── Shop Filters ── */
  'shop.filters':      { EN: 'Filters',       BN: 'ফিল্টার' },
  'shop.hideFilters':  { EN: 'Hide Filters',  BN: 'ফিল্টার লুকান' },
  'shop.close':        { EN: 'Close',         BN: 'বন্ধ' },
  'shop.category':     { EN: 'Category',      BN: 'ক্যাটাগরি' },
  'shop.clearFilters': { EN: 'Clear Filters', BN: 'ফিল্টার মুছুন' },
  'shop.adjustFilters': { EN: 'Try adjusting your filters', BN: 'ফিল্টার পরিবর্তন করে দেখুন' },

  /* ── Product Card ── */
  'product.curatedImport': { EN: 'Curated Import', BN: 'বাছাই আমদানি' },
  'product.delivery710': { EN: 'Delivery: 7-10 Days', BN: 'ডেলিভারি: ৭-১০ দিন' },
  'product.unavailable': { EN: 'Currently unavailable', BN: 'বর্তমানে অনুপলব্ধ' },
  'product.limitedStock': { EN: 'Limited stock', BN: 'সীমিত স্টক' },

  /* ── Checkout ── */
  'checkout.title':    { EN: 'Checkout',      BN: 'চেকআউট' },
  'checkout.name':     { EN: 'Full Name',     BN: 'পুরো নাম' },
  'checkout.phone':    { EN: 'Phone Number',  BN: 'ফোন নম্বর' },
  'checkout.address':  { EN: 'Delivery Address', BN: 'ডেলিভারি ঠিকানা' },
  'checkout.district': { EN: 'District',      BN: 'জেলা' },
  'checkout.payment':  { EN: 'Payment Method', BN: 'পেমেন্ট পদ্ধতি' },
  'checkout.cod':      { EN: 'Cash on Delivery', BN: 'ক্যাশ অন ডেলিভারি' },
  'checkout.bkash':    { EN: 'bKash',         BN: 'বিকাশ' },
  'checkout.nagad':    { EN: 'Nagad',         BN: 'নগদ' },
  'checkout.place':    { EN: 'Place Order',   BN: 'অর্ডার দিন' },
  'checkout.summary':  { EN: 'Order Summary', BN: 'অর্ডার সারসংক্ষেপ' },

  /* ── Order Success ── */
  'success.title':     { EN: 'ORDER CONFIRMED', BN: 'অর্ডার নিশ্চিত!' },
  'success.sub':       { EN: 'Your order is being prepared', BN: 'আপনার অর্ডার প্রস্তুত হচ্ছে' },
  'success.orderSummary': { EN: 'Order Summary', BN: 'অর্ডার সারসংক্ষেপ' },
  'success.orderId':   { EN: 'Order ID',      BN: 'অর্ডার নম্বর' },
  'success.customer':  { EN: 'Customer Name', BN: 'গ্রাহকের নাম' },
  'success.address':   { EN: 'Delivery Address', BN: 'ডেলিভারি ঠিকানা' },
  'success.total':     { EN: 'Total Amount',  BN: 'মোট পরিমাণ' },
  'success.status':    { EN: 'Order Status',  BN: 'অর্ডার অবস্থা' },
  'success.step1':     { EN: 'Confirmed',     BN: 'নিশ্চিত' },
  'success.step2':     { EN: 'Processing',    BN: 'প্রক্রিয়াকরণ' },
  'success.step3':     { EN: 'Delivery',      BN: 'ডেলিভারি' },
  'success.returnHome': { EN: 'Return Home',  BN: 'হোমে ফিরুন' },
  'success.discoverMore': { EN: 'Discover More', BN: 'আরও দেখুন' },

  /* ── Support ── */
  'support.title1':    { EN: 'CUSTOMER',      BN: 'কাস্টমার' },
  'support.title2':    { EN: 'SUPPORT.',      BN: 'সাপোর্ট।' },
  'support.track':     { EN: 'Order Tracking', BN: 'অর্ডার ট্র্যাকিং' },
  'support.trackDesc': { EN: 'Track your order status and delivery updates in real-time.', BN: 'রিয়েল-টাইমে আপনার অর্ডার ও ডেলিভারি ট্র্যাক করুন।' },
  'support.care':      { EN: 'Customer Care', BN: 'কাস্টমার কেয়ার' },
  'support.careDesc':  { EN: 'Reach our support team quickly via WhatsApp or email for any queries.', BN: 'যেকোনো প্রশ্নে WhatsApp বা ইমেইলে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।' },
  'support.quality':   { EN: 'Quality Guarantee', BN: 'মান নিশ্চয়তা' },
  'support.qualityDesc': { EN: 'All products are 100% authentic, imported directly from verified global suppliers.', BN: 'সব পণ্য ১০০% প্রামাণিক, যাচাইকৃত বৈশ্বিক সরবরাহকারীর কাছ থেকে সরাসরি আমদানি।' },
  'support.whatsapp':  { EN: 'Chat on WhatsApp', BN: 'WhatsApp-এ চ্যাট করুন' },
  'support.email':     { EN: 'Send Email', BN: 'ইমেইল পাঠান' },
  'support.phone':     { EN: 'Call Us', BN: 'ফোন করুন' },

  /* ── Auth ── */
  'auth.login':        { EN: 'Sign In',       BN: 'লগইন' },
  'auth.signup':       { EN: 'Create Account', BN: 'অ্যাকাউন্ট তৈরি করুন' },
  'auth.email':        { EN: 'Email Address', BN: 'ইমেইল ঠিকানা' },
  'auth.password':     { EN: 'Password',      BN: 'পাসওয়ার্ড' },
  'auth.name':         { EN: 'Full Name',     BN: 'পুরো নাম' },
  'auth.forgotPass':   { EN: 'Forgot Password?', BN: 'পাসওয়ার্ড ভুলে গেছেন?' },
  'auth.noAccount':    { EN: 'Don\'t have an account?', BN: 'অ্যাকাউন্ট নেই?' },
  'auth.haveAccount':  { EN: 'Already have an account?', BN: 'ইতিমধ্যে অ্যাকাউন্ট আছে?' },

  /* ── Footer ── */
  'footer.tagline':    { EN: 'Directly imported premium footwear & bags from global markets to Bangladesh. Unmatched quality, refined taste.', BN: 'বিশ্বের সেরা বাজার থেকে সরাসরি বাংলাদেশে প্রিমিয়াম ফুটওয়্যার ও ব্যাগ। অতুলনীয় মান, পরিশীলিত রুচি।' },
  'footer.office':     { EN: 'Head Office',   BN: 'প্রধান কার্যালয়' },
  'footer.contact':    { EN: 'Contact',       BN: 'যোগাযোগ' },
  'footer.collection': { EN: 'Collection',    BN: 'কালেকশন' },
  'footer.support':    { EN: 'Support',       BN: 'সহায়তা' },
  'footer.allProducts': { EN: 'All Products', BN: 'সব পণ্য' },
  'footer.shoes':      { EN: 'Shoes',         BN: 'জুতা' },
  'footer.bags':       { EN: 'Bags',          BN: 'ব্যাগ' },
  'footer.tracking':   { EN: 'Order Tracking', BN: 'অর্ডার ট্র্যাকিং' },
  'footer.about':      { EN: 'About Splaro',  BN: 'স্প্লারো সম্পর্কে' },
  'footer.privacy':    { EN: 'Privacy Policy', BN: 'গোপনীয়তা নীতি' },
  'footer.terms':      { EN: 'Terms & Conditions', BN: 'শর্তাবলী' },
  'footer.refund':     { EN: 'Refund Policy', BN: 'রিফান্ড নীতি' },
  'footer.secured':    { EN: 'Secured by Hostinger', BN: 'হোস্টিঙ্গার কর্তৃক সুরক্ষিত' },
  'footer.imported':   { EN: 'Directly imported', BN: 'সরাসরি আমদানি' },
  'footer.grade':      { EN: 'Premium Grade · Bangladesh', BN: 'প্রিমিয়াম গ্রেড · বাংলাদেশ' },

  /* ── Trust Badges ── */
  'trust.ssl':         { EN: 'SSL Secured',   BN: 'এসএসএল সুরক্ষিত' },
  'trust.sslSub':      { EN: 'Encrypted connection', BN: 'এনক্রিপ্টেড সংযোগ' },
  'trust.auth':        { EN: '100% Authentic', BN: '১০০% প্রামাণিক' },
  'trust.authSub':     { EN: 'Verified products', BN: 'যাচাইকৃত পণ্য' },
  'trust.payment':     { EN: 'Safe Payment',  BN: 'নিরাপদ পেমেন্ট' },
  'trust.paymentSub':  { EN: 'bKash · Nagad · COD', BN: 'বিকাশ · নগদ · ক্যাশ অন ডেলিভারি' },
  'trust.delivery':    { EN: 'Fast Delivery', BN: 'দ্রুত ডেলিভারি' },
  'trust.deliverySub': { EN: 'Across Bangladesh', BN: 'সারা বাংলাদেশ' },

  /* ── Story Page ── */
  'story.title1':      { EN: 'BRAND',         BN: 'ব্র্যান্ড' },
  'story.title2':      { EN: 'STORY.',        BN: 'স্টোরি।' },
  'story.empty':       { EN: 'No published stories yet.', BN: 'এখনো কোনো গল্প প্রকাশিত হয়নি।' },

  /* ── Order Tracking ── */
  'tracking.login':    { EN: 'Log In to Track', BN: 'ট্র্যাক করতে লগইন করুন' },
  'tracking.create':   { EN: 'Create Account', BN: 'অ্যাকাউন্ট তৈরি করুন' },
  'tracking.noOrders': { EN: 'No orders found for your account yet.', BN: 'আপনার অ্যাকাউন্টে এখনো কোনো অর্ডার নেই।' },
  'tracking.status':   { EN: 'Status',        BN: 'অবস্থা' },
  'tracking.total':    { EN: 'Total',         BN: 'মোট' },

  /* ── Why Choose Us (Service Pillars) ── */
  'why.delivery':      { EN: 'Fast Delivery',       BN: 'দ্রুত ডেলিভারি' },
  'why.deliverysub':   { EN: 'Delivered across Bangladesh in 2–4 days', BN: '২–৪ দিনের মধ্যে সারা বাংলাদেশে ডেলিভারি' },
  'why.returns':       { EN: 'Easy Returns',         BN: 'সহজ রিটার্ন' },
  'why.returnssub':    { EN: 'Hassle-free returns within the policy window', BN: 'নির্ধারিত সময়ের মধ্যে ঝামেলামুক্ত রিটার্ন' },
  'why.quality':       { EN: '100% Authentic',       BN: '১০০% প্রামাণিক' },
  'why.qualitysub':    { EN: 'Every product verified before dispatch', BN: 'প্রতিটি পণ্য পাঠানোর আগে যাচাই করা হয়' },
  'why.support':       { EN: '24/7 Support',         BN: '২৪/৭ সহায়তা' },
  'why.supportsub':    { EN: 'WhatsApp & phone support around the clock', BN: 'সার্বক্ষণিক WhatsApp ও ফোন সাপোর্ট' },

  /* ── Testimonials ── */
  'testimonial.label': { EN: 'CUSTOMER REVIEWS',    BN: 'গ্রাহক রিভিউ' },
  'testimonial.title1': { EN: 'WHAT OUR',           BN: 'আমাদের গ্রাহকরা' },
  'testimonial.title2': { EN: 'CLIENTS SAY.',       BN: 'কী বলেন।' },
  'testimonial.r1':    { EN: 'The Nike Dunks I ordered arrived in perfect condition — exactly as shown. Fastest delivery I\'ve ever seen from an online shop in Bangladesh!', BN: 'নাইকি ডাঙ্কস একদম পারফেক্ট কন্ডিশনে পেয়েছি। ছবির মতোই। বাংলাদেশে কোনো অনলাইন শপ থেকে এত দ্রুত ডেলিভারি আগে পাইনি!' },
  'testimonial.r2':    { EN: 'Absolutely stunning quality. The Gucci bag is authentic, packaging was premium, and the customer service team was so responsive on WhatsApp.', BN: 'অসাধারণ মান। গুচি ব্যাগটি সত্যিকারের, প্যাকেজিং প্রিমিয়াম ছিল এবং কাস্টমার সার্ভিস WhatsApp-এ অনেক দ্রুত রেসপন্ড করেছে।' },
  'testimonial.r3':    { EN: 'Splaro is the real deal. Ordered Adidas Ultraboost — came with original box, tags intact. Will definitely order again. Highly recommended!', BN: 'স্প্লারো সত্যিই অনন্য। আডিডাস আলট্রাবুস্ট অর্ডার করেছিলাম — অরিজিনাল বক্স ও ট্যাগ সহ এসেছে। আবার অর্ডার করবো। সবাইকে রেকমেন্ড করছি!' },

  /* ── Sale Banner ── */
  'sale.badge':        { EN: 'LIMITED TIME OFFER',  BN: 'সীমিত সময়ের অফার' },
  'sale.title1':       { EN: 'EXCLUSIVE',           BN: 'এক্সক্লুসিভ' },
  'sale.title2':       { EN: 'DEALS.',              BN: 'ডিল।' },
  'sale.sub':          { EN: 'Premium footwear & bags at unbeatable prices. Don\'t miss out on Bangladesh\'s finest luxury deals.', BN: 'অতুলনীয় দামে প্রিমিয়াম ফুটওয়্যার ও ব্যাগ। বাংলাদেশের সেরা লাক্সারি ডিল মিস করবেন না।' },
  'sale.offLabel':     { EN: 'On Selected Items',   BN: 'নির্বাচিত পণ্যে' },
  'sale.cta':          { EN: 'Shop Sale Now',        BN: 'এখনই কিনুন' },

  /* ── Newsletter / WhatsApp Subscribe ── */
  'newsletter.label':  { EN: 'STAY UPDATED',        BN: 'আপডেট থাকুন' },
  'newsletter.title':  { EN: 'GET EXCLUSIVE OFFERS', BN: 'এক্সক্লুসিভ অফার পান' },
  'newsletter.sub':    { EN: 'Join our WhatsApp channel and be the first to know about new arrivals, flash sales, and special discounts.', BN: 'আমাদের WhatsApp চ্যানেলে যোগ দিন এবং নতুন পণ্য, ফ্ল্যাশ সেল ও বিশেষ ছাড় সম্পর্কে সবার আগে জানুন।' },
  'newsletter.cta':    { EN: 'Join WhatsApp Channel', BN: 'WhatsApp চ্যানেলে যোগ দিন' },
  'newsletter.note':   { EN: 'No spam. Unsubscribe anytime. Only exclusive deals.', BN: 'স্প্যাম নেই। যেকোনো সময় আনসাবস্ক্রাইব করুন। শুধু এক্সক্লুসিভ ডিল।' },

  /* ── General ── */
  'general.loading':   { EN: 'Loading',       BN: 'লোড হচ্ছে' },
  'general.search':    { EN: 'Search',        BN: 'খুঁজুন' },
  'general.close':     { EN: 'Close',         BN: 'বন্ধ করুন' },
  'general.save':      { EN: 'Save',          BN: 'সংরক্ষণ' },
  'general.cancel':    { EN: 'Cancel',        BN: 'বাতিল' },
  'general.confirm':   { EN: 'Confirm',       BN: 'নিশ্চিত করুন' },
  'general.later':     { EN: 'Later',         BN: 'পরে' },
  'general.or':        { EN: 'or',            BN: 'অথবা' },
  'general.learnMore': { EN: 'Learn More',    BN: 'আরও জানুন' },
  'general.backHome':  { EN: 'Back to Home',  BN: 'হোমে ফিরুন' },
} as const;

export type TranslationKey = keyof typeof translations;

/**
 * Get translation for a key and language.
 */
export function t(key: TranslationKey, lang: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] ?? entry['EN'] ?? key;
}

/**
 * Hook-compatible translator factory.
 * Usage: const translate = createTranslator('BN'); translate('nav.home') → "হোম"
 */
export function createTranslator(lang: Language) {
  return (key: TranslationKey): string => t(key, lang);
}
