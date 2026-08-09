/**
 * Compatibility entry point retained for existing storefront imports.
 * New analytics code may import the typed commerce layer directly.
 */
export {
  SPLARO_ITEM_BRAND,
  toCommerceItemFromCart,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackAddToCart,
  trackAddToWishlist,
  trackBeginCheckout,
  trackGaEvent,
  trackInitiateCheckout,
  trackMetaEvent,
  trackPurchase,
  trackRemoveFromCart,
  trackSearch,
  trackSelectItem,
  trackSelectPayment,
  trackViewCart,
  trackViewContent,
  trackViewItem,
  trackViewItemList,
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
