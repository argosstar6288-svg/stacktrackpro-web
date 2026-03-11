/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stackPrimary: "#ff8f00",
        stackPrimaryLight: "#ffb300",
        stackSecondary: "#1e88e5",
        stackSecondaryLight: "#4fc3f7",
        stackDark: "#0b0f1a",
      },
    },
  },
};
