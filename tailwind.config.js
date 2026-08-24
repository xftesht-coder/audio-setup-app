export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#EDF1EF',
        card: '#FFFFFF',
        ink: '#11171A',
        muted: '#5A6A6B',
        faint: '#8A9997',
        rule: '#CBD6D2',
        signal: '#00595B',
        go: '#2A6B4A',
        stop: '#9C1F36',
        amber: '#8A5A00',
      },
      fontFamily: {
        display: ["'Golos Text'", '-apple-system', "'Segoe UI'", 'sans-serif'],
        mono: ["'JetBrains Mono'", "'SF Mono'", 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
