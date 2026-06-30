import { BadRequestException } from '@nestjs/common'

export function isGoogleServiceAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email?.includes('.iam.gserviceaccount.com'))
}

export function throwGoogleApiError(error: unknown, context: string): never {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const lower = raw.toLowerCase()

  if (lower.includes('drive api has not been used') || lower.includes('accessnotconfigured')) {
    throw new BadRequestException(
      'Google Drive API is disabled in your Google Cloud project. Open Google Cloud Console → APIs & Services → enable "Google Drive API", wait 1–2 minutes, then retry.',
    )
  }

  if (lower.includes('gmail api has not been used')) {
    throw new BadRequestException(
      'Gmail API is disabled in Google Cloud. Enable: APIs & Services → Library → Gmail API → Enable. Wait 1–2 min, then retry.',
    )
  }

  if (lower.includes('insufficient permission') || lower.includes('insufficient authentication scopes')) {
    throw new BadRequestException(
      `${context}: Google account lacks Drive permission. Reconnect in Google Workspace → Connect Google Account.`,
    )
  }

  if (lower.includes('invalid_grant') || lower.includes('token has been expired or revoked')) {
    throw new BadRequestException(
      'Google token expired or revoked. Reconnect in Google Workspace → Connect Google Account.',
    )
  }

  throw new BadRequestException(raw ? `${context}: ${raw}` : context)
}
