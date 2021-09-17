module.exports = {
  mode: "jit",
  purge: ["./src/**/*.liquid", "./src/**/*.erb"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
