import { useApp } from '../store';
import { createTranslator, TranslationKey } from './i18n';

/**
 * useTranslation — React hook for English support.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   t('nav.home') // → "Home"
 */
export function useTranslation() {
  const translate = createTranslator('EN');
  return {
    t: (key: TranslationKey) => translate(key),
    lang: 'EN',
    isBN: false,
    isEN: true,
  };
}
