/** @type {import('tailwindcss').Config} */
// UI theme matches "Payment Follow-Up System" demo: teal #09AEB8 brand, Poppins headings, soft cards.
// `indigo` and `purple` are remapped to the teal scale so every existing indigo-*/purple-* class
// across the app picks up the new brand colour without touching any logic.
const teal = {
  50: '#f1fbfb',
  100: '#e4f9fa',
  200: '#bfeef1',
  300: '#8adfe4',
  400: '#3cc7cf',
  500: '#09AEB8',
  600: '#09AEB8',
  700: '#078d96',
  800: '#066f77',
  900: '#055a61',
  950: '#033c41',
};

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      colors: {
        indigo: teal,
        purple: teal,
        brand: teal,
      },
      borderRadius: {
        xl: '10px',
        '2xl': '13px',
      },
      boxShadow: {
        sm: '0 2px 10px rgba(28,43,52,.05)',
        DEFAULT: '0 8px 28px rgba(28,43,52,.06)',
        md: '0 8px 28px rgba(28,43,52,.07)',
      },
    },
  },
  plugins: [],
};
