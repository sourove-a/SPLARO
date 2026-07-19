'use client'

import Script from 'next/script'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'

// Client-side fallback only — same priority as GoogleAnalyticsHead. The authoritative
// value (incl. server-only GA4_MEASUREMENT_ID) arrives via the envGaId prop from layout.
const ENV_GA_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? process.env.NEXT_PUBLIC_GA_ID ?? ''
const ENV_FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? ''

export function AnalyticsScripts({ envGaId }: { envGaId?: string } = {}) {
  const { marketing } = useStorefrontSettings()
  const rawEnvGa = (envGaId ?? ENV_GA_ID).trim()
  const rawDbGa = marketing?.googleAnalyticsId?.trim() ?? ''
  const envGa = /^G-[A-Z0-9]+$/i.test(rawEnvGa) ? rawEnvGa : ''
  const dbGa = /^G-[A-Z0-9]+$/i.test(rawDbGa) ? rawDbGa : ''
  // Env GA is already configured in the layout. Never configure a second
  // property in the same browser session; DB is only the fallback.
  const GA_ID = envGa ? '' : dbGa
  const rawFbPixelId = marketing?.facebookPixelId?.trim() || ENV_FB_PIXEL_ID.trim()
  const FB_PIXEL_ID = /^\d+$/.test(rawFbPixelId) ? rawFbPixelId : ''
  const serializedGaId = JSON.stringify(GA_ID)
  const serializedFbPixelId = JSON.stringify(FB_PIXEL_ID)

  if (!GA_ID && !FB_PIXEL_ID) return null

  return (
    <>
      {GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
          <Script id="splaro-ga4" strategy="lazyOnload">
            {`
              (function () {
                var id = ${serializedGaId};
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
      ) : null}

      {FB_PIXEL_ID ? (
        <>
          <Script id="splaro-meta-pixel" strategy="lazyOnload">
            {`
              (function () {
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                window.__splaroMetaInitialized = window.__splaroMetaInitialized || {};
                var id = ${serializedFbPixelId};
                if (!window.__splaroMetaInitialized[id]) {
                  window.fbq('init', id);
                  window.__splaroMetaInitialized[id] = true;
                }
                window.__splaroAnalyticsReady = window.__splaroAnalyticsReady || {};
                window.__splaroAnalyticsReady.meta = true;
                window.dispatchEvent(new Event('splaro:meta-ready'));
              })();
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}
    </>
  )
}
