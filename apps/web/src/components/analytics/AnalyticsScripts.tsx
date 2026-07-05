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
  const envGa = (envGaId ?? ENV_GA_ID).trim()
  const dbGa = marketing?.googleAnalyticsId?.trim() ?? ''
  // Env GA loads in layout (GoogleAnalyticsHead). Inject here only if admin ID differs.
  const GA_ID = dbGa && dbGa !== envGa ? dbGa : envGa ? '' : dbGa
  const FB_PIXEL_ID = marketing?.facebookPixelId?.trim() || ENV_FB_PIXEL_ID

  if (!GA_ID && !FB_PIXEL_ID) return null

  return (
    <>
      {GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="splaro-ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {FB_PIXEL_ID ? (
        <>
          <Script id="splaro-meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${FB_PIXEL_ID}');
              fbq('track', 'PageView');
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
