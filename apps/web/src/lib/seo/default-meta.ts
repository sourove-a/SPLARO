import {
  SPLARO_HOME_DESCRIPTION,
  SPLARO_HOME_TITLE,
} from '@/lib/seo/brand-positioning'
import { getStorefrontSettings } from '@/lib/storefront/settings'

/** Default title/description for pages without their own meta. */
export async function resolveDefaultStorefrontMeta(): Promise<{
  title: string
  description: string
  googleSiteVerification: string | null
}> {
  const settings = await getStorefrontSettings()
  const title = settings.config.seo?.metaTitle?.trim() || SPLARO_HOME_TITLE
  const description = settings.config.seo?.metaDescription?.trim() || SPLARO_HOME_DESCRIPTION
  const googleSiteVerification =
    settings.config.seo?.googleSiteVerification?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
    null
  return { title, description, googleSiteVerification }
}
