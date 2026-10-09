/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  corePlugins: { preflight: false }, // keep the pixel-identical hand-rolled stylesheet untouched
  theme: { extend: {} },
  plugins: [],
};

export default config;
