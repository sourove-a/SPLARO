import * as React from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-cyan-500/90 text-white border border-cyan-300/60 hover:bg-cyan-400 shadow-[0_8px_24px_rgba(34,211,238,0.32)]',
  secondary:
    'bg-white/10 text-white border border-white/20 hover:bg-white/20',
  ghost:
    'bg-transparent text-white border border-transparent hover:bg-white/10',
  outline:
    'bg-transparent text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/15 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 px-3 text-[10px]',
  md: 'h-11 px-4 text-[11px]',
  lg: 'h-12 px-5 text-[11px]',
  icon: 'h-11 w-11 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'interactive-control inline-flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-[0.14em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071327] disabled:opacity-50 disabled:pointer-events-none touch-manipulation min-h-11',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };

