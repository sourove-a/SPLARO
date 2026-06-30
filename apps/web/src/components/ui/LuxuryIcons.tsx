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
  return (
    <svg
      viewBox="0 0 28 28"
      className={cn('h-7 w-7', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M6.5 7.5h15a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H11.2L6 22.8V9.7a2.2 2.2 0 0 1 2.2-2.2Z"
        fill="#4a4f55"
      />
      <path
        d="M6.5 7.5h15a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H11.2L6 22.8V9.7a2.2 2.2 0 0 1 2.2-2.2Z"
        stroke="#2f3338"
        strokeWidth="0.6"
      />
      <circle cx="11.2" cy="13.8" r="1.15" fill="#fff" />
      <circle cx="14.5" cy="13.8" r="1.15" fill="#fff" />
      <circle cx="17.8" cy="13.8" r="1.15" fill="#fff" />
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
