import { cn } from '@/lib/utils/cn'

interface IconProps {
  className?: string
}

export function BagPlusIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-[1.15rem] w-[1.15rem]', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M7.5 8V6.75a4.25 4.25 0 0 1 8.5 0V8"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path
        d="M6 8.5h12l-1.05 10.2a1.2 1.2 0 0 1-1.19 1.08H8.24a1.2 1.2 0 0 1-1.19-1.08L6 8.5Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path d="M12 11.5v3.25" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M10.35 13.15h3.3" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  )
}

export function SupportBubbleIcon({ className }: IconProps) {
  return <LiveSupportBubble {...(className ? { className } : {})} />
}

/** Three-dot live typing wave — ILLIYEEN-style support FAB */
export function LiveSupportBubble({ className }: IconProps) {
  return (
    <span className={cn('support-live-bubble', className)} aria-hidden>
      <span className="support-live-bubble__dot" />
      <span className="support-live-bubble__dot" />
      <span className="support-live-bubble__dot" />
    </span>
  )
}

/** Premium arc icons — ILLIYEEN-style thin stroke marks */
export function SupportPhoneIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('support-premium-icon', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M9.4 3.4 10.8 7.8l-1.7 1a11.8 11.8 0 0 0 5.3 5.3l1-1.7 4.4 1.3v3.1c0 .7-.5 1.3-1.2 1.4-5.9.9-11.1-4.5-12-10.5-.1-.7.5-1.3 1.2-1.4l3.2-.1Z" />
    </svg>
  )
}

export function SupportChatIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('support-premium-icon', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M7 8.2h10a1.8 1.8 0 0 1 1.8 1.8v4.8a1.8 1.8 0 0 1-1.8 1.8H11l-3.2 2.6V10a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Official-style WhatsApp mark for premium support surfaces */
export function WhatsAppBrandIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('support-premium-icon support-premium-icon--whatsapp', className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12.04 2.2a9.8 9.8 0 0 0-8.45 14.9L2.2 21.8l4.95-1.3a9.8 9.8 0 1 0 4.89-18.3Zm0 17.65a7.85 7.85 0 0 1-4-1.08l-.29-.17-3.05.8.81-2.97-.19-.33a7.85 7.85 0 1 1 6.72 3.75Zm4.35-5.55c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12l-.78.96c-.16.2-.32.2-.6.08a6.4 6.4 0 0 1-3.18-2.78c-.24-.34 0-.52.18-.7l.48-.48c.12-.12.24-.32.12-.5l-.78-1.82c-.2-.46-.4-.46-.54-.46h-.52c-.18 0-.46.08-.64.34-.18.26-.72.92-.72 2.24s.74 2.58.84 2.76a9 9 0 0 0 3.48 3.14c.48.2.86.32 1.16.42.48.16.92.14 1.26.08.38-.06 1.18-.48 1.34-.94.16-.46.16-.86.12-.94-.04-.08-.18-.12-.42-.2Z"
      />
    </svg>
  )
}

export function SupportScrollIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('support-premium-icon', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M12 7.2v7.2M8.8 11.2 12 7.2l3.2 4"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SupportCloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('support-premium-icon support-premium-icon--close', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M8 8l8 8M16 8l-8 8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CircleChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="none" aria-hidden>
      <path
        d="M14.5 7.5 10 12l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CircleChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="none" aria-hidden>
      <path
        d="M9.5 7.5 14 12l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
