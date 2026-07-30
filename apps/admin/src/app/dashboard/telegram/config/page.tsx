import { redirect } from 'next/navigation'

/** Legacy path → dedicated Telegram Bot screen (not Settings SMTP). */
export default function LegacyTelegramConfigPage() {
  redirect('/dashboard/telegram-bot')
}
