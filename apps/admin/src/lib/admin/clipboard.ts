import { toastFail, toastOk } from './feedback'

/** Copy text then toast — green only after clipboard succeeds. */
export async function copyWithToast(text: string, okMessage: string): Promise<boolean> {
  const value = text.trim()
  if (!value) {
    toastFail('Nothing to copy')
    return false
  }
  try {
    await navigator.clipboard.writeText(value)
    toastOk(okMessage, `clipboard:${okMessage}`)
    return true
  } catch {
    toastFail('Could not copy to clipboard')
    return false
  }
}
