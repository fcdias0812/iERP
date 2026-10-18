import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'server/dist',
    'server/data',
    'src/routeTree.gen.ts',
    'public/mockServiceWorker.js',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    rules: {
      // Rotas do TanStack exportam `Route` junto do componente.
      'react-refresh/only-export-components': [
        'warn',
        {
          allowExportNames: [
            'Route',
            'buttonVariants',
            'badgeVariants',
            'fieldBase',
            'MASKS',
            'toast',
          ],
        },
      ],
    },
  },
  {
    // Backend (Node + Express): sem regras de React.
    files: ['server/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },
])
