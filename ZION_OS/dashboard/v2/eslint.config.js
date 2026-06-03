import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // React 19 experimental react-hooks rules — vzory v projektu jsou validní (fetch v useEffect)
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      // Date.now() pro relativní časy v render (re-render přijde s novými daty z parent)
      'react-hooks/purity': 'off',
    },
  },
  {
    // E2E testy běží v Node + Playwright runner
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
