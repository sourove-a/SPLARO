import { Injectable, OnModuleInit } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer

  onModuleInit() {
    const raw = process.env['ENCRYPTION_KEY']?.trim()
    if (!raw || raw.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY is required (minimum 32 characters). Add it to .env before starting the API.',
      )
    }
    this.key = scryptSync(raw, 'splaro-integration-v1', 32)
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
  }

  decrypt(stored: string): string {
    if (!stored.startsWith('enc:')) return stored
    const [, ivB, tagB, dataB] = stored.split(':')
    if (!ivB || !tagB || !dataB) throw new Error('Invalid encrypted payload')
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }

  mask(secret: string | null | undefined): string | null {
    if (!secret) return null
    if (secret.length <= 8) return '••••••••'
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
  }

  isMaskedInput(value: string | undefined | null): boolean {
    return !value || value.includes('••••')
  }
}
