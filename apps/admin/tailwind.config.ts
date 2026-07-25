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
          success: 'var(--admin-success)',
          warning: 'var(--admin-warning)',
          danger: 'var(--admin-danger)',
          info: 'var(--admin-info)',
        },
        neutral: {
          50: 'var(--admin-neutral-50)',
          100: 'var(--admin-neutral-100)',
          200: 'var(--admin-neutral-200)',
          300: 'var(--admin-neutral-300)',
          400: 'var(--admin-neutral-400)',
          500: 'var(--admin-neutral-500)',
          600: 'var(--admin-neutral-600)',
          700: 'var(--admin-neutral-700)',
          800: 'var(--admin-neutral-800)',
          900: 'var(--admin-neutral-900)',
        },
      },
      borderRadius: {
        'admin-sm': 'var(--admin-radius-sm)',
        'admin-md': 'var(--admin-radius-md)',
        'admin-lg': 'var(--admin-radius-lg)',
      },
      boxShadow: {
        glass: 'var(--admin-elev-1)',
        'glass-soft': 'var(--admin-elev-1)',
        'admin-1': 'var(--admin-elev-1)',
        'admin-2': 'var(--admin-elev-2)',
      },
      transitionDuration: {
        admin: '160ms',
      },
      transitionTimingFunction: {
        admin: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

export default config
