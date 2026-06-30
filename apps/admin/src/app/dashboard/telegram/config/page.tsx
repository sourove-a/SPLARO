import { redirect } from 'next/navigation'

export default function LegacyTelegramConfigPage() {
  redirect('/dashboard/telegram-bot')
}
