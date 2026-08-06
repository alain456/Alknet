/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1F4D3D',
        secondary: '#14231C',
        accent: '#C98A2E',
        clay: '#A64B2A',
        paper: '#F4F5F0',
        surface: '#FAFAFA',
        ink: '#1C2620',
        'ink-muted': '#5C6660',
        'ink-faint': '#8A928C',
        border: '#DDE1D8',
        success: '#2F7A4F',
        error: '#B23A2E',
      },
    },
  },
  plugins: [],
}
