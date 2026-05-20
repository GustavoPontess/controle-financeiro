import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Regra nova do React 19 — radical contra setState em effect. Sem alternativa
      // pragmática pra load-on-mount sem framework (Suspense / React Query).
      // Reavaliar quando adotar React Query (issue futura).
      'react-hooks/set-state-in-effect': 'off',
      // exhaustive-deps re-ativada: cada `useEffect` deve ter suas dependências corretas.
      // Onde loadData é chamado no mount, usar useCallback.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
])
