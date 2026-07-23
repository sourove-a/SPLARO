type IconProps = {
  className?: string
}

/** Minimal SPLARO-styled social marks — thin stroke, quiet luxury. */
export function SplaroInstagramIcon({ className = 'h-[1.12rem] w-[1.12rem]' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="4.25" />
      <circle cx="12" cy="12" r="3.35" />
      <circle cx="17.15" cy="6.85" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SplaroYoutubeIcon({ className = 'h-[1.12rem] w-[1.12rem]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="3.25"
        y="6.75"
        width="17.5"
        height="10.5"
        rx="3.1"
        stroke="currentColor"
        strokeWidth="1.55"
      />
      <path
        d="M10.6 9.35v5.3l5.15-2.65-5.15-2.65z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function SplaroFacebookIcon({ className = 'h-[1.12rem] w-[1.12rem]' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.75" />
      <path
        d="M13.35 8.1h-1.55c-.95 0-1.72.77-1.72 1.72V12H8.4v2.05h1.68V19h2.42v-4.95h2.05l.35-2.05h-2.4v-1.05c0-.48.39-.87.87-.87h1.13V8.1z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function SplaroTikTokIcon({ className = 'h-[1.12rem] w-[1.12rem]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M15.8 4.2c.45 2.35 1.85 4.15 3.85 4.65v2.55c-1.35-.05-2.55-.5-3.55-1.15v5.05c0 3.45-2.8 5.75-5.9 5.6-2.85-.15-5.25-2.4-5.4-5.3-.2-3.55 2.65-6.5 6.15-6.5.3 0 .65.02.95.08v2.7c-.3-.08-.6-.12-.9-.12-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7V4.2h2.4z" />
    </svg>
  )
}

/** Footer jewel icons — thin, bright, luxury. */
export function SplaroMapPinIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.35" />
    </svg>
  )
}

export function SplaroPhoneIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8.2 4.8c.4-.4 1-.5 1.5-.3l2 .7c.5.2.8.7.7 1.2l-.4 2c-.1.4.1.8.4 1.1l1.5 1.5c.3.3.7.5 1.1.4l2-.4c.5-.1 1 .2 1.2.7l.7 2c.2.5.1 1.1-.3 1.5l-1.1 1.1c-.9.9-2.3 1.2-3.5.7-2.6-1.1-5-3.5-6.1-6.1-.5-1.2-.2-2.6.7-3.5L8.2 4.8z" />
    </svg>
  )
}

export function SplaroMailIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="3.6"
        y="5.75"
        width="16.8"
        height="12.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.55"
      />
      <path
        d="M4.4 7.2 11.2 12.1a1.5 1.5 0 0 0 1.7 0L19.6 7.2"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SplaroWhatsAppIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.04 3.2c-4.8 0-8.7 3.85-8.7 8.6 0 1.52.4 2.95 1.1 4.2L3.2 20.8l4.95-1.3c1.2.66 2.55 1 4 1h.01c4.8 0 8.7-3.85 8.7-8.6-.02-4.75-3.92-8.7-8.82-8.7zm5.05 12.35c-.21.6-1.25 1.1-1.74 1.17-.45.06-1.02.09-1.65-.1-.38-.12-.87-.28-1.5-.55-2.64-1.14-4.36-3.8-4.49-3.97-.13-.18-1.07-1.42-1.07-2.72 0-1.3.68-1.94.92-2.2.24-.26.52-.33.7-.33.17 0 .35 0 .5.01.16.01.37-.06.58.44.21.52.72 1.78.78 1.91.06.13.1.28.02.45-.08.17-.12.28-.24.43-.12.15-.25.33-.36.44-.12.12-.24.25-.1.49.14.24.62 1.02 1.33 1.65 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.25.09 1.56.74 1.83.87.27.13.45.2.52.31.07.11.07.64-.14 1.24z" />
    </svg>
  )
}

export const SOCIAL_BRAND_ICONS = {
  instagram: SplaroInstagramIcon,
  youtube: SplaroYoutubeIcon,
  facebook: SplaroFacebookIcon,
  tiktok: SplaroTikTokIcon,
} as const
