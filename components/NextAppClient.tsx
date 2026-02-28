'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

const AppShell = dynamic(() => import('../App'), { ssr: false });

export default function NextAppClient() {
  return (
    <GlobalErrorBoundary>
      <AppShell />
    </GlobalErrorBoundary>
  );
}

