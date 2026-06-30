import toast from 'react-hot-toast'

export type RowActionItem = {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

type BuildRowActionsArgs = {
  moduleHref: string
  recordId: string
  recordName: string
  navigate: (href: string) => void
  close: () => void
}

function copyText(text: string, message: string, close: () => void) {
  close()
  void navigator.clipboard.writeText(text).then(
    () => toast.success(message, { style: { borderRadius: '14px', fontWeight: 600 } }),
    () => toast.error('Could not copy to clipboard'),
  )
}

/** Contextual row actions for modules without dedicated detail pages. */
export function buildRowActionPresets({
  moduleHref,
  recordId,
  recordName,
  navigate,
  close,
}: BuildRowActionsArgs): RowActionItem[] | null {
  const go = (href: string) => {
    close()
    navigate(href)
  }

  switch (moduleHref) {
    case '/dashboard/attributes':
      return [
        { label: 'Browse products', onClick: () => go('/dashboard/products') },
        { label: 'Copy attribute ID', onClick: () => copyText(recordId, `Copied "${recordId}"`, close) },
      ]
    case '/dashboard/inventory':
    case '/dashboard/brands':
    case '/dashboard/sku-manager':
    case '/dashboard/barcode-manager':
    case '/dashboard/qr-manager':
      return [
        { label: 'Open products', onClick: () => go('/dashboard/products') },
        { label: 'Copy reference', onClick: () => copyText(recordId, 'Reference copied', close) },
      ]
    case '/dashboard/returns-rma':
    case '/dashboard/subscriptions':
    case '/dashboard/transactions':
      return [
        { label: 'View in module', onClick: () => go(moduleHref) },
        { label: 'Copy ID', onClick: () => copyText(recordId, 'ID copied', close) },
      ]
    case '/dashboard/coupons':
    case '/dashboard/whatsapp':
    case '/dashboard/affiliate':
    case '/dashboard/influencers':
      return [
        { label: 'Open marketing hub', onClick: () => go('/dashboard/campaigns') },
        { label: 'Copy reference', onClick: () => copyText(recordName, 'Copied', close) },
      ]
    case '/dashboard/keywords':
    case '/dashboard/schema-manager':
    case '/dashboard/redirect-manager':
      return [
        { label: 'Open SEO center', onClick: () => go('/dashboard/seo-health') },
        { label: 'Copy reference', onClick: () => copyText(recordId, 'Copied', close) },
      ]
    case '/dashboard/wms/warehouses':
    case '/dashboard/wms/transfers':
      return [
        { label: 'Open WMS', onClick: () => go('/dashboard/wms/overview') },
        { label: 'Copy ID', onClick: () => copyText(recordId, 'ID copied', close) },
      ]
    case '/dashboard/automation/telegram-notifications':
      return [
        { label: 'Telegram settings', onClick: () => go('/dashboard/telegram-bot') },
        { label: 'Copy rule ID', onClick: () => copyText(recordId, 'Rule ID copied', close) },
      ]
    case '/dashboard/email-sms':
      return [
        { label: 'Open campaigns', onClick: () => go('/dashboard/campaigns') },
        { label: 'Copy template ID', onClick: () => copyText(recordId, 'Copied', close) },
      ]
    case '/dashboard/ai-agent':
    case '/dashboard/ai-sales':
      return [
        { label: 'Open AI center', onClick: () => go('/dashboard/ai-analytics') },
        { label: 'Copy reference', onClick: () => copyText(recordId, 'Copied', close) },
      ]
    default:
      return null
  }
}

export function buildFallbackRowActions({
  moduleHref,
  recordId,
  recordName,
  navigate,
  close,
}: BuildRowActionsArgs): RowActionItem[] {
  const go = (href: string) => {
    close()
    navigate(href)
  }

  return [
    { label: 'Go to module', onClick: () => go(moduleHref) },
    {
      label: 'Copy reference',
      onClick: () => copyText(recordId || recordName, 'Reference copied', close),
    },
    {
      label: 'Archive',
      tone: 'danger',
      onClick: () => {
        close()
        toast(`${recordName} — archive from the live module panel when available.`, { icon: 'ℹ️' })
      },
    },
  ]
}
