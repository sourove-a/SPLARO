import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // SPLARO Design Tokens
        ivory: {
          DEFAULT: '#FFFFFF',
          50: '#FFFFFF',
          100: '#FFFFFF',
          200: '#F5F5F5',
          300: '#EEEEEE',
        },
        gold: {
          DEFAULT: '#101114',
          light: '#3f3f46',
          dark: '#09090b',
          muted: '#e4e4e7',
        },
        luxury: {
          black: '#111111',
          dark: '#1A1A1A',
          gray: '#6B6B6B',
          border: 'rgba(17,17,17,0.08)',
          glass: 'rgba(255,255,255,0.72)',
        },
      },

      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', ...fontFamily.serif],
        sans: ['var(--font-inter)', ...fontFamily.sans],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1.05' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
        editorial: ['clamp(3rem,8vw,7rem)', { lineHeight: '1' }],
      },

      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.04em',
        wider: '0.08em',
        widest: '0.16em',
        luxury: '0.25em',
        ultrawide: '0.35em',
      },

      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        88: '22rem',
        100: '25rem',
        112: '28rem',
        128: '32rem',
        144: '36rem',
      },

      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },

      backdropBlur: {
        xs: '2px',
        glass: '20px',
      },

      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },

      transitionTimingFunction: {
        luxury: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer: 'shimmer 2s infinite',
        'spl-radix-accordion-down': 'splRadixAccordionDown 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'spl-radix-accordion-up': 'splRadixAccordionUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'spl-radix-fade-in': 'splRadixFadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'spl-radix-fade-out': 'splRadixFadeOut 140ms ease-out',
        'spl-radix-slide-in': 'splRadixSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        splRadixAccordionDown: {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        splRadixAccordionUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        splRadixFadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        splRadixFadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        splRadixSlideIn: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },

      aspectRatio: {
        portrait: '3/4',
        square: '1/1',
        hero: '16/9',
        product: '4/5',
      },

      boxShadow: {
        luxury: '0 4px 40px rgba(0,0,0,0.06)',
        'luxury-lg': '0 8px 60px rgba(0,0,0,0.10)',
        'luxury-hover': '0 12px 60px rgba(0,0,0,0.14)',
        glass: '0 8px 32px rgba(17,17,17,0.04)',
        gold: '0 4px 24px rgba(16,17,20,0.16)',
      },
    },
  },
  plugins: [],
}

export default config
