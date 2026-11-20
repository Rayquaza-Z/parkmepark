/**
 * tailwind.config.cjs – premium palette
 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1F5C3F',   // premium green
        secondary: '#2E4A6B', // premium blue
        cream: '#FAF7F0',     // off‑white cream
      },
    },
  },
  plugins: [],
};
