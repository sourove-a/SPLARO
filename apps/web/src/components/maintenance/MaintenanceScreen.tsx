import Image from 'next/image'
import { FlipCountdown } from './FlipCountdown'

const DEFAULT_UNTIL = '2026-07-01T00:00:00+06:00'

interface MaintenanceScreenProps {
  until?: string
  title?: string
  message?: string
}

export function MaintenanceScreen({
  until = process.env.NEXT_PUBLIC_MAINTENANCE_UNTIL ?? DEFAULT_UNTIL,
  title = "We're Getting a Makeover!",
  message = "Our website is currently undergoing scheduled maintenance to bring you a better experience. We'll be back online soon — stay tuned!",
}: MaintenanceScreenProps) {
  return (
    <div className="maint-screen">
      <div className="maint-screen__noise" aria-hidden />
      <div className="maint-screen__glow" aria-hidden />

      <div className="maint-screen__content">
        <header className="maint-brand">
          <Image
            src="/images/logo/splaro-logo-white.svg"
            alt="SPLARO"
            width={280}
            height={70}
            priority
            unoptimized
            className="maint-brand__logo"
          />
        </header>

        <h1 className="maint-title">{title}</h1>
        <p className="maint-message">{message}</p>

        <FlipCountdown targetIso={until} />

        <p className="maint-footer">
          Need help?{' '}
          <a href="mailto:info@splaro.co" className="maint-footer__link">
            info@splaro.co
          </a>
        </p>
      </div>
    </div>
  )
}
