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
        // Token names kept so existing component classes keep working;
        // values moved from dark "console" theme to light-clean ANBK palette (Desain.md).
        console: {
          bg: '#F6F8FB',
          panel: '#FFFFFF',
          raised: '#F8FAFC',
          line: '#E5EAF1',
          faint: '#F1F5F9',
        },
        ink: {
          strong: '#111827',
          DEFAULT: '#374151',
          muted: '#64748B',
          faint: '#94A3B8',
        },
        accent: {
          DEFAULT: '#1A56DB',
          soft: '#2563EB',
          deep: '#1E40AF',
        },
        ok: {
          DEFAULT: '#16A34A',
          deep: '#15803D',
        },
        bad: {
          DEFAULT: '#DC2626',
          deep: '#B91C1C',
        },
      },
      screens: {
        xs: '480px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'panel': '0 1px 2px 0 rgba(16,24,40,0.06), 0 8px 24px -12px rgba(16,24,40,0.10)',
        'pop': '0 24px 48px -12px rgba(16,24,40,0.20)',
        'glow': '0 0 24px -6px rgba(26,86,219,0.35)',
      },
      letterSpacing: {
        label: '0.12em',
      },
    },
  },
  plugins: [],
}
