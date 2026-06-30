import { Injectable } from '@nestjs/common'
import { verifyAdminSessionToken, type AdminSessionPayload } from '../../common/auth/admin-session.util'

@Injectable()
export class AuthService {
  verifyToken(token: string): AdminSessionPayload | null {
    return verifyAdminSessionToken(token)
  }
}
