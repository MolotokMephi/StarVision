/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        star: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdeff',
          300: '#8ec9ff',
          400: '#59abff',
          500: '#3389ff',
          600: '#1a6af5',
          700: '#1454e1',
          800: '#1744b6',
          900: '#193c8f',
          950: '#142657',
        },
        void: {
          900: '#030712',
          800: '#0a0f1e',
          700: '#0f172a',
        },
      },
      fontFamily: {
        display: ['"Exo 2"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Nunito Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
