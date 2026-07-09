import { redirect } from 'next/navigation'

/** Legacy route — Telegram config lives in Settings → Notifications. */
export default function LegacyTelegramBotPage() {
  redirect('/dashboard/settings?section=notifications#telegram')
}
