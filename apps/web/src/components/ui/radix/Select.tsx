'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { radixSelectContent, radixSelectItem } from './luxury-styles'

export const LuxurySelect = SelectPrimitive.Root
export const LuxurySelectGroup = SelectPrimitive.Group
export const LuxurySelectValue = SelectPrimitive.Value

export const LuxurySelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    chevronClassName?: string
  }
>(({ className, children, chevronClassName, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'spl-radix-select-trigger inline-flex items-center justify-between gap-2 outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200', chevronClassName)}
        strokeWidth={2.2}
        aria-hidden
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
LuxurySelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const LuxurySelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(radixSelectContent, className)}
      position={position}
      sideOffset={sideOffset}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
LuxurySelectContent.displayName = SelectPrimitive.Content.displayName

export const LuxurySelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    indicator?: ReactNode
  }
>(({ className, children, indicator, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn(radixSelectItem, className)} {...props}>
    {indicator !== null ? (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          {indicator ?? <Check className="h-3 w-3" strokeWidth={2.4} />}
        </SelectPrimitive.ItemIndicator>
      </span>
    ) : null}
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
LuxurySelectItem.displayName = SelectPrimitive.Item.displayName
