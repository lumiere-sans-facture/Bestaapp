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
      // Les documents composent « 4,96 kWc » avec une espace fine insécable
      // (U+202F) ou insécable (U+00A0) : c'est une CONVENTION du projet, pas
      // un caractère collé par accident. Elle vit dans des gabarits et des
      // expressions régulières, d'où ces exceptions. Hors de ces contextes,
      // la règle reste active : un espace exotique dans du code est un bug.
      'no-irregular-whitespace': ['error', {
        skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true,
      }],
    },
  },
  {
    // Tests : environnement Vitest
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Code exécuté par NODE, jamais par le navigateur : fonctions serverless
    // Vercel (api/), scripts de bout en bout, outils de prévisualisation et
    // fichiers de configuration. Sans cette déclaration, `process` y était
    // signalé comme inexistant — 16 fausses alertes qui masquaient les vraies.
    files: [
      'api/**/*.js',
      'e2e/**/*.{js,mjs}',
      '**/*.mjs',
      'vite.config.js',
      'eslint.config.js',
      'capacitor.config.*',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
];
