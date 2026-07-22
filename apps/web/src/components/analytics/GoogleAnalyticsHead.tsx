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

const RAW_GOOGLE_ADS_ID = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? '').trim()
export const GOOGLE_ADS_ENV_ID = /^AW-\d+$/i.test(RAW_GOOGLE_ADS_ID) ? RAW_GOOGLE_ADS_ID : ''

/** GA4 (+ optional Google Ads) — env; admin GA override via AnalyticsScripts. */
export function GoogleAnalyticsHead() {
  if (!GA_ENV_ID && !GOOGLE_ADS_ENV_ID) return null
  const serializedGaId = JSON.stringify(GA_ENV_ID)
  const serializedAdsId = JSON.stringify(GOOGLE_ADS_ENV_ID)
  const loaderId = GA_ENV_ID || GOOGLE_ADS_ENV_ID

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${loaderId}`}
        strategy="lazyOnload"
      />
      <Script id="splaro-ga4-head" strategy="lazyOnload">
        {`
          (function () {
            var gaId = ${serializedGaId};
            var adsId = ${serializedAdsId};
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            window.__splaroGaConfigured = window.__splaroGaConfigured || {};
            window.gtag('js', new Date());
            if (gaId && !window.__splaroGaConfigured[gaId]) {
              window.gtag('config', gaId, { anonymize_ip: true, send_page_view: false });
              window.__splaroGaConfigured[gaId] = true;
            }
            if (adsId && !window.__splaroGaConfigured[adsId]) {
              window.gtag('config', adsId);
              window.__splaroGaConfigured[adsId] = true;
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
