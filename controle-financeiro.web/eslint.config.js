import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { TELAS_LEGADO } from './eslint-legado-telas.js'

// Trava do padrão de telas internas (skill `pontes-telas`, docs/features/padrao-telas/plano.md).
// Fora: site público, vitrine do DS e telas cheias sem Navbar (login, cadastro, convite, onboarding).
const SEM_NAVBAR = [
  'src/pages/Site/**',
  'src/pages/DesignSystem/**',
  'src/pages/Auth/**',
  'src/pages/Convite/**',
  'src/pages/Onboarding/**',
]
const RECEITA = 'Siga a receita da skill pontes-telas (.claude/skills/pontes-telas/SKILL.md).'

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
  {
    files: ['src/pages/**/*.tsx'],
    // `[id].tsx`: colchete é classe no glob; `[[]` / `[]]` casa o caractere literal.
    ignores: [...SEM_NAVBAR, ...TELAS_LEGADO.map((p) => p.replace(/\[|\]/g, (c) => `[${c}]`))],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "JSXOpeningElement[name.name='table']", message: `Sem <table> cru em tela interna: use a coleção do DS (lista/tabela/cards). ${RECEITA}` },
        { selector: "JSXOpeningElement[name.name='h1']", message: `Sem <h1> em tela interna: o título mora na Navbar. ${RECEITA}` },
        { selector: "JSXOpeningElement[name.name='PontesTable']", message: `PontesTable pagina só no cliente; lista paginada vai no servidor. ${RECEITA}` },
      ],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mui/*'], message: 'Zero MUI (purgado no #166): use @/components/pontes.' },
          { group: ['@/components/pontes/*', '**/components/pontes/*'], message: 'Importe do barrel @/components/pontes, não do arquivo interno.' },
        ],
      }],
    },
  },
])
