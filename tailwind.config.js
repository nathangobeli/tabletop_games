/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'container-dark': '#2a2e33',
        'accent-light': '#fdfcfb',
        'player-1': '#3b82f6',
        'player-2': '#ef4444',
      },
      backgroundImage: {
        'primary-bg': 'radial-gradient(circle at 50% 30%, #f3e9dc 0%, #d8c3a5 100%)',
      },
      boxShadow: {
        'table-recess': 'inset 2px 4px 8px rgba(0,0,0,0.5), inset -1px -1px 3px rgba(255,255,255,0.15)',
        'table-flat': '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2)',
        'table-lifted': '0 12px 20px -3px rgba(0,0,0,0.45), 0 4px 6px -4px rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      padding: {
        'safe': 'env(safe-area-inset-bottom, 1rem)',
      },
    },
  },
  plugins: [],
}
