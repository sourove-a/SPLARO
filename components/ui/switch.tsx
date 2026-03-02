'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-7 w-14 items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c670] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
        checked ? 'border-[#e8c670] bg-[#e8c670]/25' : 'border-[#46381f] bg-[#0d0d0d]',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'mx-1 inline-block h-5 w-5 rounded-full transition-transform duration-200',
          checked ? 'translate-x-7 bg-[#e8c670]' : 'translate-x-0 bg-[#65563a]',
        )}
      />
    </button>
  );
});

Switch.displayName = 'Switch';

export { Switch };
