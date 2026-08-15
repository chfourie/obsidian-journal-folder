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

// 0.4 added `eslint-comments/no-restricted-disable`, which forbids inline
// `eslint-disable` of a fixed list of rules outright (`obsidianmd/*`,
// `@typescript-eslint/no-deprecated`, `@typescript-eslint/no-explicit-any`, …).
// Its intent — stop careless suppressions slipping past the scanner — is one we
// want, so the rule is never switched off. Where a suppression is genuinely
// unavoidable we re-declare the rule for *those files only*, re-deriving the
// upstream pattern list (so patterns added upstream keep applying) and appending
// a gitignore-style `!` negation for the one rule that site needs.
const RESTRICTED_DISABLE_PATTERNS = obsidianmd.configs.recommended
  .flatMap((config) => config.rules?.['eslint-comments/no-restricted-disable'] ?? [])
  .slice(1) // drop the leading severity

if (RESTRICTED_DISABLE_PATTERNS.length === 0) {
  throw new Error(
    'eslint-plugin-obsidianmd no longer configures eslint-comments/no-restricted-disable; ' +
      're-derive the per-file allowances below before trusting this config.'
  )
}

const allowDisabling = (...rules) => ({
  'eslint-comments/no-restricted-disable': [
    'error',
    ...RESTRICTED_DISABLE_PATTERNS,
    ...rules.map((rule) => `!${rule}`),
  ],
})

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
  {
    files: ['src/**/*.{ts,svelte}'],
    rules: {
      // Sentence case is right for prose and wrong for proper names and format
      // specimens. `ignoreRegex` is the rule's own escape hatch, so these three
      // exemptions live here — visible and reviewable — rather than as inline
      // disables, which `no-restricted-disable` (rightly) rejects. Keep
      // `enforceCamelCaseLower` from the upstream options; re-declaring a rule
      // replaces its options wholesale.
      'obsidianmd/ui/sentence-case': [
        'warn',
        {
          enforceCamelCaseLower: true,
          ignoreRegex: [
            // The plugin's own name and its feature names, as they appear in
            // manifest.json and in the sidebar view titles.
            '\\bJournal (Folder|Tasks)\\b',
            // Lucide, the icon library, is a proper noun.
            '\\bLucide\\b',
            // "Today" is the plugin's one-click feature name, so it keeps
            // its capital mid-sentence when naming that feature.
            "\\bToday (action|picker|button)\\b",
            // A leading hex-colour format specimen ('#rrggbb …') is a sample
            // value, not a word — capitalising its first digit would be wrong.
            '^#[0-9a-zA-Z]{3,8}\\b',
          ],
        },
      ],
    },
  },
  {
    // Synthetic journal notes for files that don't exist on disk are duck-typed
    // plain objects cast `as unknown as TFile` (a documented project convention:
    // `new TFile()` routes `path` through an internal setter that crashes on
    // post-construction assignment). `instanceof TFile` — the rule's suggested
    // alternative — cannot apply to a file the vault has never seen.
    files: [
      'src/data-access/template-folder.ts',
      'src/features/journal-folder-sidebar/sidebar-anchor.ts',
    ],
    rules: allowDisabling('obsidianmd/no-tfile-tfolder-cast'),
  },
  {
    // Colocated contract specs run under Vitest + jsdom, where Obsidian's
    // `createEl`/`createSpan` prototype extensions don't exist — the rule's
    // suggested replacements would throw. Plain DOM construction is correct
    // here; the rule still guards every shipped module.
    files: ['src/**/*.spec.ts'],
    rules: { 'obsidianmd/prefer-create-el': 'off' },
  },
])
