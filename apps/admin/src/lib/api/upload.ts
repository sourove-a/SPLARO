export async function uploadAdminImage(file: File, folder = 'products') {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  form.append('optimize', '1')
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data.url as string
}
