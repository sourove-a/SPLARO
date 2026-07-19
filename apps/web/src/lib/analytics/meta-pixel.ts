/**
 * Compatibility entry point retained for existing storefront imports.
 * New analytics code may import the typed commerce layer directly.
 */
export {
  trackAddPaymentInfo,
  trackAddToCart,
  trackAddToWishlist,
  trackBeginCheckout,
  trackGaEvent,
  trackInitiateCheckout,
  trackMetaEvent,
  trackPurchase,
  trackSearch,
  trackSelectPayment,
  trackViewContent,
  trackViewItem,
} from './commerce'

export type {
  CommerceAnalyticsEvent,
  CommerceItemInput,
  Ga4CommercePayload,
  Ga4CommerceItem,
  Ga4PurchasePayload,
  MetaCommercePayload,
  PurchaseAnalyticsInput,
} from './commerce'
