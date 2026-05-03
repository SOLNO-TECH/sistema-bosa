/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#CBAC80',   /* color exacto de bosa.mx --surface-accent */
          light:   '#DEC89F',
          dark:    '#937C58',
          shine:   '#E8D4A8',
        },
        navy: {
          950: '#050D1A',
          900: '#071221',
          800: '#0A192E',
          700: '#0D203B',
          600: '#112848',
          500: '#1A3660',
        },
      },
      fontFamily: {
        /* Títulos grandes: Neogrotesk Small Caps Light */
        display: ['"Neogrotesk SC"', 'Manrope', 'Arial', 'sans-serif'],
        /* Títulos pequeños / labels: PODIUM Sharp 7.7 */
        label:   ['"PODIUM Sharp"', 'Manrope', 'Arial', 'sans-serif'],
        /* Cuerpo / UI: Transducer */
        sans:    ['Transducer', 'Manrope', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A96E 0%, #F0D080 50%, #9A7A4A 100%)',
      },
      boxShadow: {
        'gold':     '0 0 24px rgba(201,169,110,0.20)',
        'gold-lg':  '0 0 48px rgba(201,169,110,0.28)',
        'card':     '0 4px 32px rgba(0,0,0,0.45)',
        'card-lg':  '0 8px 48px rgba(0,0,0,0.55)',
      },
      animation: {
        'fade-in':  'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'shimmer':  'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
      },
    },
  },
  plugins: [],
};
