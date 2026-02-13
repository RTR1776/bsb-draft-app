/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bsb-navy': '#1a1a2e',
        'bsb-dark': '#16213e',
        'bsb-mid': '#0f3460',
        'bsb-accent': '#e94560',
        'bsb-gold': '#ffd700',
        'bsb-green': '#00c853',
        'bsb-dim': '#8892b0',
      },
    },
  },
  plugins: [],
}
