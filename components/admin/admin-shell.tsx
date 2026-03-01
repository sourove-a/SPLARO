import { Shield, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdminRole } from '@/app/admin/_lib/types';
import { AdminSidebar } from './admin-sidebar';

export function AdminShell({ role, children }: { role: AdminRole; children: ReactNode }) {
  return (
    <div className="splaro-admin min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px]">
        <AdminSidebar role={role} />

        <div className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-8">
          <header className="admin-panel-card px-5 py-4 md:px-7 md:py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="admin-kicker">Luxury Commerce Suite</p>
                <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-[#f6f1e6]">SPLARO Command Center</h1>
                <p className="mt-2 text-sm text-[#968a74]">Calm, high-contrast operations UI tuned for scale and clarity.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-[#3a2f1b] bg-[#151108] px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#e8c670] font-semibold inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Dark Luxury Theme
                </div>
                <div className="rounded-xl border border-[#2d3d33] bg-[#101912] px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#9ad6b2] font-semibold inline-flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" /> Role: {role.replace('_', ' ')}
                </div>
              </div>
            </div>
          </header>

          <main className="mt-5 md:mt-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
