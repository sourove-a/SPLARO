import * as React from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-gradient-to-r from-[rgba(201,169,110,0.22)] to-[rgba(160,120,64,0.14)] text-[#E8C987] border border-[rgba(201,169,110,0.45)] hover:from-[rgba(201,169,110,0.35)] hover:to-[rgba(160,120,64,0.25)] shadow-[0_8px_24px_rgba(201,169,110,0.20)]',
  secondary:
    'bg-white/8 text-white border border-[rgba(201,169,110,0.20)] hover:bg-[rgba(201,169,110,0.10)] hover:border-[rgba(201,169,110,0.35)]',
  ghost:
    'bg-transparent text-[#F5F0E8] border border-transparent hover:bg-[rgba(201,169,110,0.08)]',
  outline:
    'bg-transparent text-[#C9A96E] border border-[rgba(201,169,110,0.35)] hover:bg-[rgba(201,169,110,0.10)] hover:text-[#E8C987]',
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
          'interactive-control inline-flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-[0.14em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFFFF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none touch-manipulation min-h-11',
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

