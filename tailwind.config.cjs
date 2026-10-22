// Tailwind: dezelfde huisstijl als het CRM (kleuren en lettertype uit src/tailwind.thema.cjs).
// De CSS wordt bij het bouwen één keer gemaakt, in plaats van in de browser.
const thema = require('./src/tailwind.thema.cjs');

module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/**/*.{html,js}'],
  ...thema,
};
