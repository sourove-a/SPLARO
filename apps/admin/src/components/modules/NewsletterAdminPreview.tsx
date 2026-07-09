'use client'

import { Mail, Send, Sparkles } from 'lucide-react'
import type { NewsletterConfig } from '@/lib/api/settings'

export function NewsletterAdminPreview({ config }: { config: NewsletterConfig }) {
  if (!config.enabled) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center rounded-[24px] border border-dashed border-black/12 bg-[#f4f4f6] px-6 text-center">
        <p className="text-sm font-semibold text-[#6B6B6B]">Newsletter section is hidden on the storefront.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[#0b0c0e] shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
      <div className="border-b border-white/8 px-4 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7848]">Live preview</p>
      </div>
      <div className="relative px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative mx-auto max-w-md">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7848]">
            {config.eyebrow || 'Stay connected'}
          </p>
          <h3 className="mt-3 font-serif text-[clamp(1.65rem,4vw,2.35rem)] font-medium leading-none text-white">
            {config.title || 'Be the first to know.'}
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-[0.82rem] font-medium leading-relaxed text-white/52">
            {config.subtitle}
          </p>

          {config.perks?.length ? (
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {config.perks.filter(Boolean).map((perk) => (
                <li
                  key={perk}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/72"
                >
                  <Sparkles className="h-3 w-3 text-zinc-500 dark:text-zinc-300" />
                  {perk}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.035] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/34" />
                <div className="flex h-10 items-center rounded-[12px] border border-white/10 bg-black/25 pl-9 pr-3 text-left text-[12px] font-semibold text-white/30">
                  {config.placeholder || 'Your email address'}
                </div>
              </div>
              <div className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-white px-4 text-[11px] font-black text-[#101114]">
                {config.buttonLabel || 'Subscribe'}
                <Send className="h-3 w-3" />
              </div>
            </div>
          </div>

          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">
            {config.note || 'No spam. Unsubscribe anytime.'}
          </p>
        </div>
      </div>
    </div>
  )
}
