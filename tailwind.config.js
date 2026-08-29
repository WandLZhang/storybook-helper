/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        yue: ['VF-Canto', 'system-ui', 'sans-serif'],
        cmn: ['Hanzi-Pinyin', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
