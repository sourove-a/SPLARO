import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', ...defaultTheme.fontFamily.sans],
        serif: ['Cormorant Garamond', ...defaultTheme.fontFamily.serif],
      },
      colors: {
        gold: {
          DEFAULT: 'rgb(var(--admin-brand-gold-rgb) / <alpha-value>)',
          dim: 'var(--admin-brand-gold-muted)',
          border: 'var(--admin-brand-gold-border)',
        },
        splaro: {
          gold: 'var(--admin-gold)',
          'gold-muted': 'var(--admin-gold-muted)',
        },
        admin: {
          bg: 'var(--admin-bg)',
          text: 'var(--admin-text)',
          secondary: 'var(--admin-text-secondary)',
          muted: 'var(--admin-text-muted)',
          strong: 'var(--admin-text-strong)',
          surface: 'var(--admin-surface)',
        },
      },
      boxShadow: {
        glass: '0 18px 50px rgba(17, 17, 20, 0.06)',
        'glass-soft': '0 8px 28px rgba(17, 17, 20, 0.04)',
      },
    },
  },
  plugins: [],
}

export default config
