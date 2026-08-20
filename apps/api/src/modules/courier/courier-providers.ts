export const BOOKABLE_COURIER_PROVIDERS = [
  { value: 'STEADFAST', label: 'Steadfast Courier', recommended: true },
  { value: 'PATHAO', label: 'Pathao Courier', recommended: false },
  { value: 'REDX', label: 'REDX', recommended: false },
  { value: 'PAPERFLY', label: 'Paperfly', recommended: false },
  { value: 'SUNDARBAN', label: 'Sundarban Courier', recommended: false },
  { value: 'SA_PARIBAHAN', label: 'SA Paribahan', recommended: false },
] as const

export type BookableCourierProvider = (typeof BOOKABLE_COURIER_PROVIDERS)[number]['value']

export interface CourierProviderAvailability {
  value: BookableCourierProvider
  label: string
  recommended: boolean
  configured: boolean
}

export function withCourierProviderAvailability(
  configured: Record<BookableCourierProvider, boolean>,
): CourierProviderAvailability[] {
  return BOOKABLE_COURIER_PROVIDERS.map((provider) => ({
    ...provider,
    configured: Boolean(configured[provider.value]),
  }))
}
