/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#091610',
          900: '#0f241a',
          800: '#143527',
          700: '#1a4835',
          600: '#236047',
          500: '#2e7a5c',
        },
        olive: {
          900: '#2d3727',
          800: '#3d4a36',
          700: '#4f6046',
          600: '#647959',
          500: '#7c9470',
        },
        cream: {
          50: '#fdfbf9',
          100: '#f8f4ed',
          200: '#efe6d8',
          300: '#e3d4c0',
        },
        sand: {
          50: '#f9f7f2',
          100: '#f1ede3',
          200: '#e3dac7',
          300: '#d3c4a8',
          400: '#beaa88',
        },
        wood: {
          900: '#382215',
          800: '#4a2f1e',
          700: '#613f28',
          600: '#7b5236',
        },
        gold: {
          300: '#e8cf8d',
          400: '#dfbf69',
          500: '#c5a059',
          600: '#a8833e',
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
