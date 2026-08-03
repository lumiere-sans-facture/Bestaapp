// Configuration ESLint — filet de sécurité minimal mais strict là où ça compte.
//
// Motivation : un `ReferenceError` (variable supprimée mais encore référencée
// dans du JSX) est passé jusqu'en production et blanchissait l'écran. Le build
// Vite ne détecte pas ce cas. `no-undef` le rattrape à coup sûr.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'android/**', 'ios/**', 'node_modules/**', '**/*.json'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        __APP_VERSION__: 'readonly',
        __APP_ENV__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,

      // ---- Les règles qui protègent réellement la production ----
      'no-undef': 'error',           // variable référencée mais inexistante
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',

      // ---- Bruit inutile sur ce projet ----
      'react/prop-types': 'off',     // pas de typage runtime, la revue suffit
      'react/no-unescaped-entities': 'off', // UI en français : apostrophes partout
      'no-empty': ['error', { allowEmptyCatch: true }], // catch vides assumés
    },
  },
  {
    // Tests : environnement Vitest
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Fichiers de configuration exécutés par Node
    files: ['vite.config.js', 'eslint.config.js', 'capacitor.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
];
