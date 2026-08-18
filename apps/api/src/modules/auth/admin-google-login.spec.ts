import { ForbiddenException } from '@nestjs/common'
import { AuthService } from './auth.service'

describe('AuthService.loginWithGoogle', () => {
  const buildService = () => {
    const service = Object.create(AuthService.prototype) as AuthService
    return service
  }

  const profile = {
    email: 'splaro.bd@gmail.com',
    emailVerified: true,
    firstName: 'Sourove',
    lastName: 'Ahammed',
  }

  it('rejects owner Google sign-in because owner must use Telegram token', async () => {
    const service = buildService()
    await expect(service.loginWithGoogle(profile)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects invited staff Google sign-in because invited roles must use password', async () => {
    const service = buildService()
    await expect(
      service.loginWithGoogle({ ...profile, email: 'manager@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
