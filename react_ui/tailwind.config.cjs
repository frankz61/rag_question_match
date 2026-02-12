/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e9ff',
          200: '#bad7ff',
          300: '#8fbeff',
          400: '#629fff',
          500: '#3f7cf2',
          600: '#2f62d7',
          700: '#274eb4',
          800: '#244392',
          900: '#233c74',
        },
      },
      boxShadow: {
        card: '0 12px 30px rgba(19, 45, 89, 0.1)',
      },
    },
  },
  plugins: [],
}
