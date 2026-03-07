import { useApp } from '../store';
import { createTranslator, TranslationKey } from './i18n';

/**
 * useTranslation — React hook for bilingual EN/BN support.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   t('nav.home') // → "হোম" (if BN) or "Home" (if EN)
 */
export function useTranslation() {
  const { language } = useApp();
  const translate = createTranslator(language);
  return {
    t: (key: TranslationKey) => translate(key),
    lang: language,
    isBN: language === 'BN',
    isEN: language === 'EN',
  };
}
