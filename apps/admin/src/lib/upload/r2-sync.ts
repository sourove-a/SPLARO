import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const MIME_MAP: Record<string, string> = {
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
}

let client: S3Client | null = null
let bucket = ''
let publicBase = ''

function getClient(): S3Client | null {
  if (client) return client
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY?.trim()
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY?.trim()
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT?.trim()
  const b = process.env.CLOUDFLARE_R2_BUCKET?.trim()
  if (!accessKey || !secretKey || !endpoint || !b) return null
  if (accessKey === 'your-r2-access-key') return null
  client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  })
  bucket = b
  publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || endpoint).replace(/\/+$/, '')
  return client
}

/**
 * Upload a local file to R2 in the background. Returns the R2 public URL
 * or null if R2 is not configured. Never throws — disk is the source of truth.
 */
export async function syncToR2(
  localPath: string,
  storedUrl: string,
  contentType?: string,
): Promise<string | null> {
  const s3 = getClient()
  if (!s3) return null
  try {
    const key = storedUrl.replace(/^\//, '')
    const body = await readFile(localPath)
    const mime = contentType || MIME_MAP[path.extname(localPath).toLowerCase()] || 'application/octet-stream'
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return `${publicBase}/${key}`
  } catch {
    return null
  }
}

/**
 * Sync multiple files (e.g. product pipeline variants) to R2.
 * Runs in parallel, best-effort — never blocks the upload response.
 */
export async function syncManyToR2(
  files: Array<{ localPath: string; storedUrl: string; contentType?: string }>,
): Promise<void> {
  const s3 = getClient()
  if (!s3) return
  await Promise.allSettled(files.map((f) => syncToR2(f.localPath, f.storedUrl, f.contentType)))
}
