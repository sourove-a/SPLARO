'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { radixDialogContent, radixOverlay } from './luxury-styles'

export const LuxuryDialog = DialogPrimitive.Root
export const LuxuryDialogTrigger = DialogPrimitive.Trigger
export const LuxuryDialogClose = DialogPrimitive.Close
export const LuxuryDialogPortal = DialogPrimitive.Portal

export const LuxuryDialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(radixOverlay, className)} {...props} />
))
LuxuryDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const LuxuryDialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean
    closeLabel?: string
  }
>(({ className, children, hideClose, closeLabel = 'Close', ...props }, ref) => (
  <LuxuryDialogPortal>
    <LuxuryDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(radixDialogContent, className)}
      {...props}
    >
      {children}
      {!hideClose ? (
        <DialogPrimitive.Close
          type="button"
          className="spl-radix-dialog-close absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center border border-luxury-black/10 bg-white/90 text-luxury-black transition-colors duration-150 hover:border-luxury-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </LuxuryDialogPortal>
))
LuxuryDialogContent.displayName = DialogPrimitive.Content.displayName

export const LuxuryDialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-serif text-xl tracking-tight text-luxury-black', className)}
    {...props}
  />
))
LuxuryDialogTitle.displayName = DialogPrimitive.Title.displayName

export const LuxuryDialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm leading-relaxed text-luxury-gray', className)}
    {...props}
  />
))
LuxuryDialogDescription.displayName = DialogPrimitive.Description.displayName
