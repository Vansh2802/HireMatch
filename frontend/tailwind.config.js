/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary dark surfaces
        dark: {
          900: '#10110F',
          800: '#171815',
          700: '#20211D',
          600: '#2A2B26',
          500: '#34352F',
        },
        // Primary light surfaces
        ivory: {
          50: '#FFFCF6',
          100: '#F5F1E8',
          200: '#EDE7D8',
          300: '#E5DED2',
        },
        // Brand — burnt orange
        brand: {
          50:  '#FBE7D9',
          100: '#F7CEAE',
          200: '#F3B484',
          300: '#EF9A59',
          400: '#EB812E',
          500: '#E76B2F',
          600: '#E76B2F',
          700: '#CC5422',
          800: '#A84418',
          900: '#85350F',
        },
        // Semantic text
        ink: {
          primary: '#191A17',
          secondary: '#73746D',
          muted: '#9E9F98',
          inverted: '#F5F1E8',
          'inverted-secondary': '#B8B7AE',
        },
        // Status
        success: '#26845A',
        'success-light': '#D1F0E3',
        warning: '#B97921',
        'warning-light': '#FDF3DC',
        error: '#C7443D',
        'error-light': '#FAE2E1',
        // Border colors
        border: {
          light: '#E5DED2',
          dark: '#34352F',
          subtle: '#EDEBE4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Inter', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        widest: '0.25em',
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        sm: '0 1px 2px rgba(0,0,0,0.06)',
        focus: '0 0 0 3px rgba(231,107,47,0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
