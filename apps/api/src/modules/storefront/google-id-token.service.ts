import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { OAuth2Client } from 'google-auth-library'

export interface GoogleIdTokenPayload {
  googleId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName: string
  picture?: string
}

@Injectable()
export class GoogleIdTokenService {
  private client: OAuth2Client | null = null

  private resolveClientId(): string {
    return (
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      ''
    )
  }

  isConfigured(): boolean {
    return Boolean(this.resolveClientId())
  }

  private getClient(): OAuth2Client {
    const clientId = this.resolveClientId()
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured')
    }
    if (!this.client) this.client = new OAuth2Client(clientId)
    return this.client
  }

  async verify(credential: string): Promise<GoogleIdTokenPayload> {
    const token = credential?.trim()
    if (!token) throw new UnauthorizedException('Google credential is required')
    const clientId = this.resolveClientId()

    try {
      const ticket = await this.getClient().verifyIdToken({
        idToken: token,
        audience: clientId,
      })
      const payload = ticket.getPayload()
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google sign-in')
      }

      const name = (payload.name ?? '').trim()
      const parts = name.split(/\s+/).filter(Boolean)
      const firstName = parts[0] ?? 'Customer'
      const lastName = parts.slice(1).join(' ') || firstName

      return {
        googleId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: Boolean(payload.email_verified),
        firstName,
        lastName,
        ...(payload.picture ? { picture: payload.picture } : {}),
      }
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ServiceUnavailableException) {
        throw err
      }
      throw new UnauthorizedException('Google sign-in could not be verified')
    }
  }
}
