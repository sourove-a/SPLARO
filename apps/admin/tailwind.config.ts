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
          DEFAULT: '#111111',
          dim: 'rgba(17,17,17,0.06)',
        },
        admin: {
          bg: '#F4F4F5',
          text: '#111111',
          secondary: '#71717A',
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
