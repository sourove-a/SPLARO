'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { radixAccordionContent, radixAccordionTrigger } from './luxury-styles'

export const LuxuryAccordion = AccordionPrimitive.Root

export const LuxuryAccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn('spl-radix-accordion-item', className)} {...props} />
))
LuxuryAccordionItem.displayName = AccordionPrimitive.Item.displayName

export const LuxuryAccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(radixAccordionTrigger, className)}
      {...props}
    >
      {children}
      <ChevronDown
        className="h-4 w-4 shrink-0 text-luxury-gray transition-transform duration-200 group-data-[state=open]:rotate-180"
        strokeWidth={2.2}
        aria-hidden
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
LuxuryAccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

export const LuxuryAccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(radixAccordionContent, className)}
    {...props}
  >
    <div className="pb-1 pt-0">{children}</div>
  </AccordionPrimitive.Content>
))
LuxuryAccordionContent.displayName = AccordionPrimitive.Content.displayName
