import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'server/node_modules', 'server/.aws-sam']),

  // Browser bundle: React app under src/.
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Node/CommonJS: the Express API, its scripts and its tests. Linting these
  // with browser globals produced ~760 bogus `no-undef` errors on require /
  // module / process / __dirname, which made `npm run lint` useless as a gate.
  {
    files: ['server/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // `_next` — Express error middleware must keep its 4-arg shape to be
      // recognised, so the unused 4th param stays. `ignoreRestSiblings` allows
      // the `({ omitMe, ...rest }) => rest` idiom used to strip internal fields
      // from API responses.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },

  // Node ESM: build config and the .mjs smoke scripts under src/lib.
  {
    files: ['*.config.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
])
