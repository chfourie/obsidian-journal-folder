// ESLint flat config — Obsidian community-plugin guideline linter.
//
// `eslint-plugin-obsidianmd` is the same ruleset the Obsidian community
// review scanner runs against a submitted plugin. Keeping it wired into the
// repo (`npm run lint`) lets us reproduce the scanner's findings locally
// instead of discovering them only after a release is scanned.
import tsparser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    ignores: [
      'main.js',
      'node_modules/',
      'docs/',
      'tests/',
      'scripts/',
      '*.mjs',
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json' },
    },
  },
  // Svelte components get the obsidianmd ruleset too (prefer-active-doc,
  // restricted imports, …). Type information comes from tsconfig.eslint.json
  // (= tsconfig.json + the .svelte files), which only ESLint reads — the
  // build's `tsc -noEmit` keeps using tsconfig.json and never sees .svelte.
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsparser,
        project: './tsconfig.eslint.json',
        extraFileExtensions: ['.svelte'],
      },
    },
    // Same plugin object the obsidianmd config registers for `**/*.ts` —
    // those blocks don't match `.svelte`, so it must be (re-)declared here.
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // The core no-undef / no-unused-vars rules don't understand TS
      // syntax (runes, type-annotation parameter names, ambient globals
      // like activeDocument) — disable them in favour of the TS-aware
      // replacement, exactly as typescript-eslint does for `.ts`.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    },
  },
])
