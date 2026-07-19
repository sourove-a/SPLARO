'use client'

import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AgentChatLauncherProps {
  online?: boolean
  className?: string
  size?: 'fab' | 'inline'
}

/** Premium chat launcher — bubble + message icon */
export function AgentChatLauncher({ online = true, className, size = 'fab' }: AgentChatLauncherProps) {
  const compact = size === 'inline'

  return (
    <span
      className={cn(
        'admin-chat-launcher relative inline-flex items-center justify-center',
        compact ? 'h-9 w-9' : 'h-12 w-12',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'admin-chat-launcher__ring absolute inset-0 rounded-2xl',
          online ? 'admin-chat-launcher__ring--on' : 'admin-chat-launcher__ring--off',
        )}
      />
      <span
        className={cn(
          'admin-chat-launcher__bubble relative flex items-center justify-center rounded-2xl border shadow-lg',
          compact ? 'h-9 w-9' : 'h-12 w-12',
          'border-white/15 bg-gradient-to-br from-[#2a2620] via-[#141414] to-[#0a0a0a]',
          'dark:border-[#5E7CFF]/30 dark:from-[#3d3428] dark:via-[#1c1814] dark:to-[#100e0c]',
        )}
      >
        <MessageCircle
          className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'text-[#5E7CFF]')}
          strokeWidth={2}
          fill="rgba(16, 17, 20, 0.12)"
        />
      </span>
      {online ? (
        <span className="admin-chat-launcher__dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--admin-bg,#0e0e13)] bg-emerald-500" />
      ) : null}
    </span>
  )
}
