/**
 * PDP review section visibility.
 *
 * The whole "গ্রাহক রিভিউ · Customer Reviews / Trusted by our community" block is
 * hidden on the storefront for now. Nothing was deleted — the component, the
 * upload route, the API endpoints and the moderation flow all still work, so
 * flipping this back to `true` restores the section as it was.
 *
 * Review structured data is gated on the same flag on purpose: Google requires
 * review markup to describe content the visitor can actually see on the page,
 * so emitting `review` / `aggregateRating` for a hidden section risks a manual
 * action instead of star snippets.
 */
export const PDP_REVIEWS_VISIBLE = false
