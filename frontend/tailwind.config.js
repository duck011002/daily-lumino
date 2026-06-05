/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary) / <alpha-value>)',
        secondary: 'hsl(var(--secondary) / <alpha-value>)',
        surface: 'hsl(var(--background) / <alpha-value>)',
        onSurface: 'hsl(var(--foreground) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        darkBg: '#161614',
        darkCard: '#1E1E1B',
        darkBorder: '#2E2E2B',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'],
        display: ['var(--font-playfair)', 'serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
