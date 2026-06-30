export interface FraudAssessment {
  score: number
  flags: string[]
  isCodRisk: boolean
}

export function assessOrderFraud(input: {
  paymentMethod: string
  total: number
  phone: string
  recentOrdersFromPhone: number
  hasFbclid: boolean
}): FraudAssessment {
  const flags: string[] = []
  let score = 0

  if (input.paymentMethod === 'CASH_ON_DELIVERY') {
    score += 15
    flags.push('cod')
  }

  if (input.total >= 15000) {
    score += 20
    flags.push('high_value')
  }

  if (input.recentOrdersFromPhone >= 3) {
    score += 25
    flags.push('repeat_phone_24h')
  }

  if (input.recentOrdersFromPhone >= 6) {
    score += 30
    flags.push('phone_spam')
  }

  const normalized = input.phone.replace(/\D/g, '')
  if (normalized.length < 11) {
    score += 20
    flags.push('invalid_phone')
  }

  if (input.hasFbclid) {
    score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    flags,
    isCodRisk: score >= 55,
  }
}
