'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Blocks,
  Box,
  CreditCard,
  FileStack,
  LayoutDashboard,
  Link2,
  Megaphone,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_MODULES } from '@/app/admin/_lib/modules';
import type { AdminRole } from '@/app/admin/_lib/types';

const roleWeight: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

const iconByHref: Record<string, any> = {
  '/admin/dashboard': LayoutDashboard,
  '/admin/products': ShoppingBag,
  '/admin/orders': Receipt,
  '/admin/customers': Users,
  '/admin/coupons-discounts': Package,
  '/admin/reviews-ratings': Star,
  '/admin/content': Blocks,
  '/admin/marketing': Megaphone,
  '/admin/shipping-logistics': Truck,
  '/admin/payments': CreditCard,
  '/admin/integrations': Link2,
  '/admin/settings': Settings,
  '/admin/security': ShieldCheck,
};

const navGroups = ['Core', 'Commerce', 'Growth', 'Platform'] as const;

export function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();

  return (
    <aside className="admin-desktop-sidebar w-80 shrink-0 border-r border-[#2a2417] bg-[#080808] px-6 py-8 sticky top-0 h-dvh overflow-y-auto">
      <div className="rounded-2xl border border-[#3a301d] bg-[#0d0d0d] p-5">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#8f846f] font-semibold">SPLARO</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f6f1e6]">Luxury Admin</h2>
        <p className="mt-3 text-xs text-[#9d917c] leading-relaxed">
          WooCommerce-grade command center with premium control surfaces.
        </p>
        <div className="mt-4 inline-flex items-center rounded-full border border-[#4f3f20] bg-[#20190d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e8c670]">
          {role.replace('_', ' ')}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {navGroups.map((group) => (
          <div key={group}>
            <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.28em] text-[#7f7563]">{group}</p>
            <div className="space-y-1.5">
              {ADMIN_MODULES.filter((item) => item.group === group).map((item) => {
                const Icon = iconByHref[item.href] || FileStack;
                const active = pathname === item.href;
                const locked = roleWeight[role] < roleWeight[item.minRole];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200',
                      active
                        ? 'border-[#6c5a33] bg-[#1c170e] text-[#f7e5bb]'
                        : 'border-transparent text-[#a69779] hover:border-[#3f3522] hover:bg-[#111111] hover:text-[#f1ddb2]',
                      locked && 'opacity-45 pointer-events-none'
                    )}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#3e3422] bg-[#0f0f0f]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[12px] uppercase tracking-[0.16em] font-semibold">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#7f7563] normal-case tracking-normal">{item.description}</span>
                    </span>
                    {locked ? (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#c59767]">Locked</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[#2c3a2f] bg-[#0f1712] p-4">
        <div className="flex items-center gap-2 text-[#8ed3ac]">
          <BarChart3 className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Live Revenue Pulse</p>
        </div>
        <p className="mt-3 text-xs text-[#9ac4ac]">Dashboard metrics update every refresh cycle with resilient fallback mode.</p>
        <p className="mt-3 text-[11px] text-[#6f987f]">SSE endpoint: <span className="text-[#a5d7bc]">/api/admin/live</span></p>
      </div>

      <div className="mt-8 rounded-2xl border border-[#332716] bg-[#151007] p-4 text-xs text-[#bda679]">
        <p className="uppercase tracking-[0.2em] text-[10px] font-semibold text-[#e8c670]">Collections</p>
        <p className="mt-2">Product, content and campaign workflows are structured as release pipelines.</p>
      </div>

      <div className="mt-8 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[#645a47]">
        <Box className="h-3.5 w-3.5 mr-2" /> SPLARO Commerce OS v2
      </div>
    </aside>
  );
}
