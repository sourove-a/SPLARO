import { admin2faPosture } from './admin-2fa-posture'

describe('admin2faPosture', () => {
  it('is ok when every staff has Telegram or TOTP', () => {
    expect(admin2faPosture({ staffTotal: 2, telegramOrTotpCount: 2, passwordLoginAllowed: false })).toEqual({
      label: 'Admin 2FA (Telegram OTP)',
      value: '100% staff Telegram-linked',
      ok: true,
    })
  })

  it('is ok with partial coverage', () => {
    expect(admin2faPosture({ staffTotal: 3, telegramOrTotpCount: 1, passwordLoginAllowed: true }).ok).toBe(true)
  })

  it('fails when password login is on and nobody has a second factor', () => {
    expect(admin2faPosture({ staffTotal: 2, telegramOrTotpCount: 0, passwordLoginAllowed: true })).toMatchObject({
      ok: false,
      value: '0% — password login has no second factor',
    })
  })

  it('is ok with no staff', () => {
    expect(admin2faPosture({ staffTotal: 0, telegramOrTotpCount: 0, passwordLoginAllowed: false }).ok).toBe(true)
  })
})
