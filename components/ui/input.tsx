import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'interactive-control flex h-12 w-full rounded-2xl border border-[#3b3422] bg-[#0a0a0a] px-4 py-3 text-sm text-[#f5f1e6] placeholder:text-[#9d8b58] focus-visible:border-[#e8c670] focus-visible:ring-2 focus-visible:ring-[#e8c670]/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
