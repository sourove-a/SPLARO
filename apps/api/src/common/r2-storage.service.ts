import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

@Injectable()
export class R2StorageService {
  private readonly log = new Logger(R2StorageService.name)
  private client: S3Client | null = null
  private bucket: string = ''
  private publicUrl: string = ''

  constructor(private readonly config: ConfigService) {
    const accessKey = this.config.get<string>('CLOUDFLARE_R2_ACCESS_KEY')?.trim()
    const secretKey = this.config.get<string>('CLOUDFLARE_R2_SECRET_KEY')?.trim()
    const endpoint = this.config.get<string>('CLOUDFLARE_R2_ENDPOINT')?.trim()
    const bucket = this.config.get<string>('CLOUDFLARE_R2_BUCKET')?.trim()
    const publicUrl = this.config.get<string>('CLOUDFLARE_R2_PUBLIC_URL')?.trim()

    if (accessKey && secretKey && endpoint && bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      })
      this.bucket = bucket
      this.publicUrl = (publicUrl || endpoint).replace(/\/+$/, '')
      this.log.log(`R2 storage configured — bucket: ${bucket}`)
    } else {
      this.log.warn('R2 storage not configured — uploads stay on disk only')
    }
  }

  get configured(): boolean {
    return this.client !== null
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.client) return { ok: false, error: 'R2 not configured' }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  /**
   * Upload a local file to R2. Returns the public URL or null if R2 is not configured.
   * The `key` is the object path in the bucket (e.g. `uploads/products/123-abc.webp`).
   */
  async uploadFile(
    localPath: string,
    key: string,
    contentType?: string,
  ): Promise<string | null> {
    if (!this.client) return null
    const body = await readFile(localPath)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || this.guessMime(key),
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return `${this.publicUrl}/${key}`
  }

  /** Upload raw buffer to R2. */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<string | null> {
    if (!this.client) return null
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || this.guessMime(key),
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return `${this.publicUrl}/${key}`
  }

  async deleteObject(key: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    if (!this.client) return null
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      const chunks: Uint8Array[] = []
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    } catch {
      return null
    }
  }

  private guessMime(key: string): string {
    const ext = path.extname(key).toLowerCase()
    const map: Record<string, string> = {
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
    return map[ext] || 'application/octet-stream'
  }
}
