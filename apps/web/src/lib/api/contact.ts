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
  if (status === 503) {
    return 'Support is temporarily unavailable. Please WhatsApp or call us directly.'
  }
  const message = Array.isArray(data.message) ? data.message[0] : data.message
  return message ?? 'Could not send your message right now.'
}

export async function submitContactForm(input: SubmitContactInput) {
  let res: Response
  try {
    res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Could not reach SPLARO support. Check your connection and try again.')
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, res.status))
  }

  return data
}
