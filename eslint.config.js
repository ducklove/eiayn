import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Never lint build output, generated/static assets, vendored docs, or dependencies.
  {
    ignores: ['dist/**', 'public/**', 'node_modules/**', 'docs/**'],
  },

  // Register .jsx alongside ESLint's default *.js/*.mjs/*.cjs set so `eslint .`
  // picks up the React components.
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  js.configs.recommended,

  // React. The codebase imports React explicitly but compiles with the automatic
  // JSX runtime (@vitejs/plugin-react), so the jsx-runtime config correctly turns
  // off react/react-in-jsx-scope and react/jsx-uses-react.
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // The codebase does not use PropTypes (no runtime prop validation).
      'react/prop-types': 'off',
    },
  },

  // Hooks correctness rules. eslint-plugin-react-hooks v7 "recommended" also
  // enables the React Compiler rule set; we intentionally configure only the
  // two classic rules the project relies on.
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Environment globals. Vitest test files get no special globals on purpose:
  // tests import describe/it/expect from 'vitest' explicitly.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Keep last: disables stylistic rules that would conflict with Prettier.
  prettier,
];
