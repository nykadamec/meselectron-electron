/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        bg: {
          main: '#0b0b0b',
          card: '#121212',
          header: '#121212',
          hover: '#1e1e1e'
        },
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8'
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        text: {
          primary: '#ffffff',
          secondary: '#a1a1aa',
          muted: '#71717a'
        },
        border: '#27272a'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
