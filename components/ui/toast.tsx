'use client';

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  message: string;
};

export function ToastViewport({
  toast,
  className,
}: {
  toast: ToastMessage | null;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          className={cn(
            'fixed bottom-6 right-6 z-[130] min-w-[260px] max-w-[420px] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md',
            toast.tone === 'success' && 'border-[#d7b66a] bg-[#131008]/95 text-[#f8e6b5]',
            toast.tone === 'error' && 'border-[#8b3d3d] bg-[#1a0d0d]/95 text-[#f2c2c2]',
            toast.tone === 'info' && 'border-[#3f4f68] bg-[#0f141d]/95 text-[#d2deef]',
            className,
          )}
        >
          <div className="flex items-start gap-2.5 text-sm leading-relaxed">
            {toast.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#e8c670]" />
            ) : toast.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[#ef9b9b]" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 text-[#9fb8dd]" />
            )}
            <p>{toast.message}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
