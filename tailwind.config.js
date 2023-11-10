/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ["./src/**/*.{html,md,liquid,erb,serb,rb}", "./frontend/javascript/**/*.js"],
  theme: {
    extend: {
      spacing: {
        "1b": "134px",
        "2b": "268px",
        "3b": "402px",
        "4b": "536px",
        "5b": "670px",
        "6b": "804px",
        "7b": "938px",
        "8b": "1072px",
        "9b": "1206px",
        "10b": "1340px",
        "11b": "1474px",
        "12b": "1608px",
        "13b": "1742px",
        "14b": "1876px",
        "15b": "2010px",
        "16b": "2144px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
