'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

const AppShell = dynamic(() => import('../App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[45vh] w-full flex items-center justify-center px-6">
      <div className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300/80 animate-pulse">
        Loading
      </div>
    </div>
  ),
});

export default function NextAppClient() {
  return (
    <GlobalErrorBoundary>
      <AppShell />
    </GlobalErrorBoundary>
  );
}
