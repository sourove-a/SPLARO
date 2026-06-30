import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const SECTION_KEYS = [
  'hero',
  'categoryMenu',
  'promoBar',
  'filters',
  'productGrid',
  'productDetail',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Hero Display',
  categoryMenu: 'Category Menu',
  promoBar: 'Promo Bar',
  filters: 'Filters / Search',
  productGrid: 'Product Grid',
  productDetail: 'Product View',
}

type Sections = Record<SectionKey, boolean>

export interface PaymentSettings {
  bkash: boolean
  nagad: boolean
}

interface AdminStore {
  sections: Sections
  payments: PaymentSettings
  isAdminOpen: boolean
  toggleSection: (key: SectionKey) => void
  togglePayment: (key: keyof PaymentSettings) => void
  setAdminOpen: (open: boolean) => void
  showAll: () => void
  hideAll: () => void
}

const defaultPayments = (): PaymentSettings => ({
  bkash: false,
  nagad: false,
})

const allVisible = () =>
  Object.fromEntries(SECTION_KEYS.map((k) => [k, true])) as Sections

const mergeVisibleDefaults = (sections?: Partial<Sections>) => {
  const merged = { ...allVisible(), ...(sections ?? {}) } as Sections
  const hasVisibleSection = SECTION_KEYS.some((key) => merged[key])

  return hasVisibleSection ? merged : allVisible()
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      sections: allVisible(),
      payments: defaultPayments(),
      isAdminOpen: false,
      toggleSection: (key) =>
        set((s) => ({ sections: { ...s.sections, [key]: !s.sections[key] } })),
      togglePayment: (key) =>
        set((s) => ({ payments: { ...s.payments, [key]: !s.payments[key] } })),
      setAdminOpen: (open) => set({ isAdminOpen: open }),
      showAll: () => set({ sections: allVisible() }),
      hideAll: () =>
        set({
          sections: {
            ...Object.fromEntries(SECTION_KEYS.map((k) => [k, false])),
            hero: true,
            productGrid: true,
          } as Sections,
        }),
    }),
    {
      name: 'splaro-admin-v3',
      merge: (persisted, current) => {
        const value = persisted as Partial<AdminStore> | undefined
        return {
          ...current,
          ...value,
          isAdminOpen: false,
          sections: mergeVisibleDefaults(value?.sections),
          payments: { ...defaultPayments(), ...(value?.payments ?? {}) },
        }
      },
    },
  ),
)
