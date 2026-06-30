'use client'

import { useCallback, useEffect } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import * as Icons from 'lucide-react'
import { ArrowRight, Search } from 'lucide-react'
import { getCommandItems } from '@/lib/navigation/admin-nav'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

function NavIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle
  return <Icon className="h-4 w-4 shrink-0 text-[var(--admin-text-secondary)]" strokeWidth={1.75} />
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { navigate } = useAdminNavigate()
  const commands = getCommandItems()
  const groups = [...new Set(commands.map((item) => item.group))]

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onClose])

  const handleSelect = useCallback(
    (href: string) => {
      navigate(href)
      onClose()
    },
    [navigate, onClose],
  )

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[12%] z-[101] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2"
          >
            <Command className="admin-command-palette overflow-hidden rounded-[28px]">
              <div className="flex items-center gap-3 border-b border-[var(--admin-glass-border)] px-4 py-4">
                <Search className="h-5 w-5 text-[var(--admin-text-secondary)]" strokeWidth={2} />
                <Command.Input
                  placeholder="Search orders, products, finance, employees, tasks, AI..."
                  className="flex-1 bg-transparent text-base font-semibold text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-muted)]"
                />
                <SplaroAdminLogo variant="mark" className="h-7 w-7" />
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
                  No results found.
                </Command.Empty>

                {groups.map((group) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="px-2 py-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--admin-text-muted)]"
                  >
                    {commands
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <Command.Item
                          key={item.href}
                          value={`${item.label} ${item.description ?? ''}`}
                          onSelect={() => handleSelect(item.href)}
                          className="flex cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 text-sm font-semibold text-[var(--admin-text)] aria-selected:bg-[var(--admin-gold-muted)]"
                        >
                          <NavIcon name={item.icon} />
                          <div className="flex-1">
                            <p>{item.label}</p>
                            {item.description ? (
                              <p className="text-xs font-medium text-[var(--admin-text-secondary)]">{item.description}</p>
                            ) : null}
                          </div>
                          <ArrowRight className="h-4 w-4 text-[var(--admin-text-muted)]" />
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
