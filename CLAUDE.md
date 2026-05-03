# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obsidian community plugin (`id: journal-folder`) that adds folder-based journaling utilities. Any folder in a vault can act as a journal — notes named `YYYY-MM-DD`, `gggg-[W]ww`, `YYYY-MM`, or `YYYY` are recognized as daily/weekly/monthly/yearly entries. The vault root is *not* supported as a journal folder due to Obsidian link-resolution behavior.

The plugin is built with TypeScript + Svelte 5 (runes API, `$props`, etc.) and bundled with esbuild into a single `main.js`.

## Commands

```bash
npm run dev        # esbuild in watch mode → main.js (inline sourcemap)
npm run build      # tsc --noEmit type check, then production esbuild
npm test           # Vitest run (one-shot)
npm run test:watch # Vitest in watch mode
npm run version    # bump manifest.json + versions.json from package.json version
```

Tests live in `tests/` and mirror the `src/` layout. ESLint and Prettier configs exist but must be run manually if desired.

## Architecture

### Plugin shell → feature set

Entry point is `src/plugin/journal-folder-plugin.ts`. It instantiates a `PluginFeatureSet` and registers each feature:

- `JournalFolderSettingsFeature` — owns the global settings, persists them via `plugin.saveData`/`loadData`, registers the settings tab, and propagates new settings to all other features.
- `JournalHeaderFeature` — registers the `journal-header` markdown code block processor.

`PluginFeatureSet` (`src/plugin/plugin-feature-set.ts`) is a tiny lifecycle multiplexer: `load`, `unload`, `useSettings`, and `onExternalSettingsChange` fan out to every registered feature with try/catch around each. Adding a new feature = create a `PluginFeature` subclass and `addFeature(...)` it in the plugin constructor.

### Feature base class and 3-layer settings resolution

All features extend `PluginFeature` (`src/data-access/plugin-feature.ts`). The important method is `getSettings(file, embeddedConfig)` — it asks `FolderSettingsResolver` to merge settings in this precedence order (later overrides earlier):

1. **Global settings** — from the plugin settings tab, persisted via `plugin.saveData`.
2. **Folder settings** — front-matter of a file named `journal-folder.md` *in the same folder as `file`*. Keys are converted via `camelCase` from `kebab-case`/`snake_case`/`Space Case` so users can write `journal-folder-title`, `JOURNAL_FOLDER_TITLE`, etc.
3. **Embedded config** — body of the current `journal-header` code block, parsed line-by-line as `key: value` and applied to that single header only.

When adding new configurable behavior, add the field to `JournalFolderSettings` + `DEFAULT_SETTINGS` in `src/data-access/journal-folder-settings.type.ts` and the resolver picks it up automatically across all three layers.

Note: `FolderSettingsResolver.getFolderConfigFile` looks up `journal-folder.md` by exact path under `file.parent` — this is intentional so subfolders with the same name don't bleed settings into each other (see commit `663a8c9`).

### Journal note model

`src/data-access/journal-note.ts` is the heart of the date logic. `journalNoteFactoryWithSettings(settings)` returns a factory that, given a `TFile`, picks one of four `JournalNoteStrategy` records (daily/weekly/monthly/yearly) by regex-matching the basename. Each strategy carries:

- `fileRegex` — validates the basename
- `filePattern` — moment.js pattern used for filenames (fixed; not user-configurable)
- `titlePattern` / `shortTitlePattern` / `mediumTitlePattern` — user-configurable display patterns. *Medium* is used when a link points to a note in a different year than the source.
- `timeUnit` — `'day' | 'week' | 'month' | 'year'`

`JournalNote` exposes navigation methods (`forwardInTime`, `backInTime`, `closestSibling`, `getHigherOrderNotes`, `getLowerOrderNotes`, `dailyNoteToday`) plus state predicates (`isPresentTime`, `isPast`, `isExistingNote`, `isToday`) and `getTimeUnit()`. Higher-order notes (year/month/week containing the current note) and lower-order notes (e.g. months within a year) feed the More popover in the header. **All date math goes through `obsidian`'s re-exported `moment`** — do not import moment directly.

For weekly note patterns, only `gg`/`gggg` reflect the year correctly (the filename uses `gggg-[W]ww`). Using `YYYY`/`GG` in title patterns will desync the displayed year from the filename.

### UI rendering (Svelte 5)

`JournalHeaderFeature.load` registers a `journal-header` code block processor. For each occurrence:

1. Resolve settings for the current file (with the code block body as embedded config).
2. Build a `JournalNote` via the factory.
3. `buildJournalHeaderInfo(settings, note)` produces a plain `JournalHeaderInfo` containing the title, `backwardLink` / `forwardLink` / `todayLink` chips for the primary row, plus `moreLinks` (higher-order period chips) and `secondaryLinks` (lower-order period entries) with their respective labels (`moreLinksLabel`, `secondaryLinksLabel`).
4. `mount(JournalHeader, { target: el, props: { info } })` — Svelte 5 `mount` API, components use runes (`$props()`).

Errors are caught and rendered via the `ErrorMessage.svelte` component instead of being thrown.

The primary row shows only `back ‹‹ More... · Today · ›› forward`. Everything else lives in the **More popover** — two labeled sections ("Jump to" for higher-order, "Day"/"Week"/"Month"/"Year" for lower-order). The popover is **portaled to `document.body`** when open and positioned with `getBoundingClientRect()` on the options bar; this is intentional — in live-preview mode the CodeMirror widget wrapping the code block clips absolutely-positioned descendants, so the panel has to escape the widget's containing block. Repositioning runs on window resize and on capture-phase `scroll` events (the editor pane scrolls separately from the window).

Secondary list date patterns are derived from the lower-order `timeUnit` and use non-breaking spaces; they intentionally drop the year because the H1 already shows it. Don't reach for the user-configured `titlePattern`/`shortTitlePattern` for these — see `secondaryTitlePatternFor` in `journal-header-info.ts`.

esbuild bundles `.svelte` files via `esbuild-svelte` with `css: 'injected'` — `styles.css` is the only CSS shipped separately (Obsidian loads it alongside `main.js`).

### Folder layout

```
src/
  plugin/         # plugin entry + feature lifecycle multiplexer
  data-access/    # settings types, FolderSettingsResolver, JournalNote, PluginFeature base
  features/       # one folder per feature; each owns its own *-feature.ts and any Svelte components
  ui/             # shared Svelte components (NoteLink, ErrorMessage)
```

Within `data-access`, every module is re-exported from `index.ts`; features import from `'src/data-access'` (path alias via `tsconfig` `baseUrl: '.'`) or relative paths.

## Release

Releases are driven by git tags. `.github/workflows/release.yml` runs `npm run build` on tag push and creates a draft GitHub release with `main.js`, `manifest.json`, and `styles.css` attached. Use `npm version <patch|minor|major>` — the `version` script syncs `manifest.json` + `versions.json` and stages them automatically.

## Conventions worth honoring

- Prettier: single quotes, 2-space indent, no semicolons, trailing commas `es5`, 80-col print width.
- License headers: every `.ts`/`.svelte` source file starts with the GPL-3.0 boilerplate. Match the existing style when adding new files.
- Date formatting always goes through Obsidian's bundled moment (`import { moment } from 'obsidian'`).
- The settings tab (`journal-folder-settings-tab.ts`) is explicitly marked as throwaway code in a comment — don't be surprised by its shape.
