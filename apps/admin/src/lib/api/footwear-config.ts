import { apiFetch } from './client'

export type FootwearPageConfig = Record<string, unknown>

export function fetchFootwearConfig() {
  return apiFetch<FootwearPageConfig>('/admin/content/footwear')
}

export function saveFootwearConfig(body: FootwearPageConfig) {
  return apiFetch<FootwearPageConfig>('/admin/content/footwear', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
