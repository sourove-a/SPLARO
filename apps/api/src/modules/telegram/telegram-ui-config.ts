export const TG_UI = {
  brandTitle: 'SPLARO Commerce OS',
  customEmoji: {
    enabled: true,
    orders: '5312361253610475399',
    courier: '5201691993775818138',
    finance: '5796253585100509494',
    inventory: '5796664978542956370',
    admin: '6145375336105250344',
    ai: '5300917828646354608',
    success: '5359595813578224654',
    warning: '5359399078306264360',
  },
  sections: {
    orders: { icon: '▣', label: 'Orders Desk' },
    courier: { icon: '◫', label: 'Courier Hub' },
    finance: { icon: '◧', label: 'Finance Hub' },
    inventory: { icon: '◨', label: 'Inventory Desk' },
    admin: { icon: '◩', label: 'Admin Desk' },
    ai: { icon: '◎', label: 'AI Assistant' },
  },
  aiPrompts: {
    salesToday: 'Give me a short summary of today sales, pending pressure, and what I should act on now.',
    codRisk: 'Review current COD risk and tell me which orders or customers need manual verification first.',
    stockRisk: 'Summarize the most urgent stock risks and tell me what needs restock attention first.',
  },
} as const

export type TgEmojiSlot = keyof typeof TG_UI.customEmoji

export function tgEmoji(slot: TgEmojiSlot, fallback: string): string {
  const id = TG_UI.customEmoji[slot]
  if (!TG_UI.customEmoji.enabled || !id) return fallback
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`
}

export function tgSectionTitle(icon: string, label: string): string {
  return `${icon} <b>${label}</b>`
}
