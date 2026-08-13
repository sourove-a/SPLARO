/** Security Center — Telegram OTP is the admin second factor, not a missing feature. */
export function admin2faPosture(input: {
  staffTotal: number
  telegramOrTotpCount: number
  passwordLoginAllowed: boolean
}): { label: 'Admin 2FA (Telegram OTP)'; value: string; ok: boolean } {
  const { staffTotal, telegramOrTotpCount, passwordLoginAllowed } = input
  const label = 'Admin 2FA (Telegram OTP)' as const
  if (staffTotal === 0) {
    return { label, value: 'No staff yet', ok: true }
  }
  const pct = Math.round((telegramOrTotpCount / staffTotal) * 100)
  if (telegramOrTotpCount === staffTotal) {
    return { label, value: `${pct}% staff Telegram-linked`, ok: true }
  }
  if (telegramOrTotpCount > 0) {
    return {
      label,
      value: `${telegramOrTotpCount}/${staffTotal} Telegram-linked`,
      ok: true,
    }
  }
  return {
    label,
    value: passwordLoginAllowed
      ? '0% — password login has no second factor'
      : '0% — Telegram OTP required, none linked',
    ok: false,
  }
}
