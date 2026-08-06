/** @type {import('tailwindcss').Config} */

/**
 * Tokens repris de la maquette « Suivi Pedagogique ».
 * Les couleurs sont nommees par role (canvas, line, muted, danger...) plutot
 * que par teinte : changer la charte ne demande alors qu'un seul passage ici.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E1B33',
        canvas: '#F4F6FA',

        navy: {
          DEFAULT: '#0C1E42', // fond de la barre laterale et des cartes sombres
          600: '#14418F',
        },

        brand: {
          DEFAULT: '#1E5FD8',
          dark: '#14418F',
          400: '#6C9BF0',
          200: '#B9CDF6',
          100: '#C9D9F8',
          50: '#EAF0FD',
        },

        line: {
          DEFAULT: '#E2E8F2',
          soft: '#EEF1F7',
          strong: '#CFD8E8',
        },

        muted: {
          DEFAULT: '#8494AD',
          strong: '#5A6A85',
          light: '#A6B2C6',
        },

        // Textes poses sur le bleu nuit.
        onnavy: {
          DEFAULT: '#A9BADB',
          dim: '#7C93BF',
          faint: '#5D74A3',
          bright: '#9FB7E4',
          soft: '#93A8CE',
          pale: '#ADC3E9',
        },

        success: { DEFAULT: '#14866B', bg: '#E7F4F0' },
        warn: { DEFAULT: '#C77A0A', bg: '#FEF7EC', ink: '#7A5307' },
        danger: { DEFAULT: '#C0405A', bg: '#FCEDF0' },
      },

      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Helvetica', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },

      keyframes: {
        omUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        omFade: { from: { opacity: '0' }, to: { opacity: '1' } },
        omGrow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        omGrowY: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        omPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(192,64,90,0.45)' },
          '50%': { boxShadow: '0 0 0 6px rgba(192,64,90,0)' },
        },
        omDraw: { from: { strokeDashoffset: '900' }, to: { strokeDashoffset: '0' } },
      },

      animation: {
        up: 'omUp .55s cubic-bezier(.2,.8,.2,1) both',
        fade: 'omFade .5s ease both',
        grow: 'omGrow .85s cubic-bezier(.2,.85,.25,1) both',
        growY: 'omGrowY .7s cubic-bezier(.2,.85,.25,1) both',
        pulseRing: 'omPulse 2.4s ease-in-out infinite',
        draw: 'omDraw 1.3s cubic-bezier(.3,.8,.3,1) both',
      },

      boxShadow: {
        card: '0 8px 22px rgba(14,27,51,0.06)',
        lift: '0 12px 28px rgba(14,27,51,0.09)',
      },
    },
  },
  plugins: [],
}
