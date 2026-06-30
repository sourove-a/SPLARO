type IconProps = {
  className?: string
}

/** Minimal SPLARO-styled social marks — thin stroke, quiet luxury. */
export function SplaroInstagramIcon({ className = 'h-[1.05rem] w-[1.05rem]' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
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

export function SplaroYoutubeIcon({ className = 'h-[1.05rem] w-[1.05rem]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="3.25"
        y="6.75"
        width="17.5"
        height="10.5"
        rx="3.1"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="M10.6 9.35v5.3l5.15-2.65-5.15-2.65z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function SplaroFacebookIcon({ className = 'h-[1.05rem] w-[1.05rem]' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
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

export function SplaroTikTokIcon({ className = 'h-[1.05rem] w-[1.05rem]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M15.8 4.2c.45 2.35 1.85 4.15 3.85 4.65v2.55c-1.35-.05-2.55-.5-3.55-1.15v5.05c0 3.45-2.8 5.75-5.9 5.6-2.85-.15-5.25-2.4-5.4-5.3-.2-3.55 2.65-6.5 6.15-6.5.3 0 .65.02.95.08v2.7c-.3-.08-.6-.12-.9-.12-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7V4.2h2.4z" />
    </svg>
  )
}

export const SOCIAL_BRAND_ICONS = {
  instagram: SplaroInstagramIcon,
  youtube: SplaroYoutubeIcon,
  facebook: SplaroFacebookIcon,
  tiktok: SplaroTikTokIcon,
} as const
