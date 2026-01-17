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
        // Dark theme palette - using CSS variables for consistency
        bg: {
          main: 'var(--color-background-base)',
          card: 'var(--color-surface-base)',
          header: 'var(--color-surface-base)',
          hover: 'var(--color-surface-elevated)'
        },
        accent: {
          DEFAULT: 'var(--color-accent-base)',
          hover: 'var(--color-accent-hover)'
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)'
        },
        border: 'var(--color-border-base)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
