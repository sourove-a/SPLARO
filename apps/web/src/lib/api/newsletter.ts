export async function subscribeNewsletter(email: string) {
  const res = await fetch('/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message
    throw new Error(message ?? 'Could not subscribe right now.')
  }

  return data
}
