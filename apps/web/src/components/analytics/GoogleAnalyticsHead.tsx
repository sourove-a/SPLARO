import Script from 'next/script'

/**
 * Single source of truth for the env-configured GA4 measurement ID.
 * Resolved server-side (layout) — GA4_MEASUREMENT_ID is not exposed to the client,
 * so pass this value as a prop to client components (see AnalyticsScripts).
 */
const RAW_GA_ENV_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.GA4_MEASUREMENT_ID ??
  ''
).trim()

export const GA_ENV_ID = /^G-[A-Z0-9]+$/i.test(RAW_GA_ENV_ID) ? RAW_GA_ENV_ID : ''

/** GA4 — loaded from env; admin can override via Settings → Marketing (client AnalyticsScripts). */
export function GoogleAnalyticsHead() {
  if (!GA_ENV_ID) return null
  const serializedId = JSON.stringify(GA_ENV_ID)

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ENV_ID}`}
        strategy="lazyOnload"
      />
      <Script id="splaro-ga4-head" strategy="lazyOnload">
        {`
          (function () {
            var id = ${serializedId};
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            window.__splaroGaConfigured = window.__splaroGaConfigured || {};
            if (!window.__splaroGaConfigured[id]) {
              window.gtag('js', new Date());
              window.gtag('config', id, { anonymize_ip: true, send_page_view: false });
              window.__splaroGaConfigured[id] = true;
            }
            window.__splaroAnalyticsReady = window.__splaroAnalyticsReady || {};
            window.__splaroAnalyticsReady.ga = true;
            window.dispatchEvent(new Event('splaro:ga-ready'));
          })();
        `}
      </Script>
    </>
  )
}
