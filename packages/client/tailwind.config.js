/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Use class-based dark mode
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      zIndex: {
        '60': '60',
        '70': '70',
      },
    },
  },
  plugins: [],
}
