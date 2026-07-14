/** Shared class tokens for SPLARO Radix primitives — sharp luxury, minimal radius. */

export const radixOverlay =
  'spl-radix-overlay fixed inset-0 z-[500] bg-luxury-black/45 backdrop-blur-[6px]'

export const radixContentBase =
  'spl-radix-content z-[510] border border-luxury-black/10 bg-ivory shadow-[0_18px_48px_-12px_rgba(17,17,17,0.22)] outline-none'

export const radixSelectContent =
  `${radixContentBase} spl-radix-select overflow-hidden rounded-none min-w-[var(--radix-select-trigger-width)]`

export const radixSelectItem =
  'spl-radix-item relative flex cursor-pointer select-none items-center gap-2.5 px-3.5 py-2.5 text-[0.8125rem] tracking-[0.02em] text-luxury-black outline-none transition-colors duration-150 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-luxury-black/[0.04] data-[state=checked]:font-medium'

export const radixAccordionTrigger =
  'spl-radix-accordion-trigger group flex w-full items-center justify-between gap-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory'

export const radixAccordionContent =
  'spl-radix-accordion-content overflow-hidden data-[state=closed]:animate-spl-radix-accordion-up data-[state=open]:animate-spl-radix-accordion-down'

export const radixDialogContent =
  `${radixContentBase} spl-radix-dialog fixed left-1/2 top-1/2 max-h-[min(92vh,900px)] w-[min(calc(100vw-2rem),960px)] -translate-x-1/2 -translate-y-1/2 rounded-none`
