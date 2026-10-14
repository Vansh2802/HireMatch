/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcfb',
          100: '#d7f7f5',
          500: '#1fb6a6',
          600: '#139b8e',
          900: '#0d2a3b',
        },
      },
    },
  },
  plugins: [],
};
