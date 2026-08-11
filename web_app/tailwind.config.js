/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        anbk: {
          blue: '#1A56DB',
          darkBlue: '#1E40AF',
          lightBlue: '#EBF5FF',
          yellow: '#EAB308',
          green: '#16A34A',
          red: '#DC2626',
        },
        console: {
          bg: '#0B0F14',
          panel: '#11171F',
          raised: '#18212C',
          line: '#232E3C',
          faint: '#161E29',
        },
        ink: {
          strong: '#F3F6FA',
          DEFAULT: '#D6DEE8',
          muted: '#8B98A9',
          faint: '#5B6879',
        },
        accent: {
          DEFAULT: '#F0B90B',
          soft: '#FACC15',
          deep: '#B45309',
        },
        ok: {
          DEFAULT: '#34D399',
          deep: '#059669',
        },
        bad: {
          DEFAULT: '#F87171',
          deep: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'panel': '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        'pop': '0 24px 48px -16px rgba(0,0,0,0.75)',
      },
      letterSpacing: {
        label: '0.12em',
      },
    },
  },
  plugins: [],
}
