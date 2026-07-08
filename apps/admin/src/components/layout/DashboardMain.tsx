'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'

interface DashboardMainProps {
  children: ReactNode
}

export function DashboardMain({ children }: DashboardMainProps) {
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    document.documentElement.classList.add('admin-dashboard-active')
    document.body.classList.add('admin-dashboard-active')
    return () => {
      document.documentElement.classList.remove('admin-dashboard-active')
      document.body.classList.remove('admin-dashboard-active')
    }
  }, [])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    main.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [pathname, reduceMotion])

  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }

  return (
    <main ref={mainRef} className="admin-main w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-4 lg:px-5 lg:pr-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          {...(reduceMotion
            ? { initial: false, animate: { opacity: 1, y: 0 } }
            : {
                initial: { opacity: 0, y: 4 },
                animate: { opacity: 1, y: 0 },
                exit: { opacity: 0 },
              })}
          transition={motionTransition}
          className="admin-dashboard-canvas min-h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
