import Script from 'next/script'

/**
 * Single source of truth for the env-configured GA4 measurement ID.
 * Resolved server-side (layout) — GA4_MEASUREMENT_ID is not exposed to the client,
 * so pass this value as a prop to client components (see AnalyticsScripts).
 */
export const GA_ENV_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.GA4_MEASUREMENT_ID ??
  ''
).trim()

/** GA4 — loaded from env; admin can override via Settings → Marketing (client AnalyticsScripts). */
export function GoogleAnalyticsHead() {
  if (!GA_ENV_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ENV_ID}`}
        strategy="afterInteractive"
      />
      <Script id="splaro-ga4-head" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ENV_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
