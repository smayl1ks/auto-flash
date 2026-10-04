/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./english_web/**/*.{html,js}",
    "./index.html",
    "./src/**/*.{html,js}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          base: '#0b0d13',
          card: '#131722',
          'card-hover': '#1b2130',
          input: '#0e111a',
          header: 'rgba(14, 17, 24, 0.95)'
        },
        accent: {
          primary: '#4f46e5',
          'primary-hover': '#4338ca',
          cyan: '#06b6d4',
          blue: '#2563eb',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b'
        },
        srs: {
          again: '#f43f5e',
          hard: '#fb923c',
          good: '#38bdf8',
          easy: '#34d399'
        }
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        glow: '0 0 24px rgba(79, 70, 229, 0.3)'
      }
    }
  },
  plugins: []
}
