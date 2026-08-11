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
        }
      }
    },
  },
  plugins: [],
}
