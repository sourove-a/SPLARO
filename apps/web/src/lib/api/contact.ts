import { getApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export interface SubmitContactInput {
  name: string
  contact: string
  subject: string
  message: string
}

function parseErrorMessage(data: { message?: string | string[] }, status: number): string {
  if (status === 429) {
    return 'Too many requests — please wait a moment and try again.'
  }
  const message = Array.isArray(data.message) ? data.message[0] : data.message
  return message ?? 'Could not send your message right now.'
}

export async function submitContactForm(input: SubmitContactInput) {
  const res = await fetch(
    `${getApiBaseUrl()}/storefront/contact?storeId=${encodeURIComponent(STORE_ID)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, res.status))
  }

  return data
}
