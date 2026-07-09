import { redirect } from 'next/navigation'

export default function LegacyTelegramConfigPage() {
  redirect('/dashboard/settings?section=notifications#telegram')
}
