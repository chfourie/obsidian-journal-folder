// ESLint flat config — Obsidian community-plugin guideline linter.
//
// `eslint-plugin-obsidianmd` is the same ruleset the Obsidian community
// review scanner runs against a submitted plugin. Keeping it wired into the
// repo (`npm run lint`) lets us reproduce the scanner's findings locally
// instead of discovering them only after a release is scanned.
import tsparser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'

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
])
