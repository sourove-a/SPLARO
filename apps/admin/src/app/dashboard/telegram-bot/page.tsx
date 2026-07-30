import type { Metadata } from 'next'

import { DcTelegramBot } from '@/components/dc/screens/DcTelegramBot'

export const metadata: Metadata = {
  title: 'Telegram Bot — SPLARO Admin',
  description: 'Bot token, chat ID & alert toggles — verified API only',
}

/** Canonical Telegram Bot setup — not Settings → SMTP. */
export default function TelegramBotPage() {
  return <DcTelegramBot />
}
