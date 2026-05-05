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

### Settings resolution

All features extend `PluginFeature` and resolve settings through three layers (later overrides earlier): global settings → folder front-matter (`journal-folder.md` in the same folder as the file) → embedded `key: value` config in the current `journal-header` code block. To add a configurable behavior, add the field to `JournalFolderSettings` + `DEFAULT_SETTINGS` in `src/data-access/journal-folder-settings.type.ts` — the resolver picks it up automatically.

See [docs/settings-resolution.md](docs/settings-resolution.md) for the per-folder lookup nuance and key-case conversion rules.

### Journal note model

`src/data-access/journal-note.ts` picks one of four `JournalNoteStrategy` records (daily/weekly/monthly/yearly) by regex-matching a `TFile`'s basename, then exposes navigation methods (`forwardInTime`, `backInTime`, `closestSibling`, `getHigherOrderNotes`, `getLowerOrderNotes`, `dailyNoteToday`) and state predicates (`isPresentTime`, `isPast`, `isExistingNote`, `isToday`). **All date math goes through `obsidian`'s re-exported `moment`** — do not import moment directly.

See [docs/journal-note.md](docs/journal-note.md) for strategy fields, *medium* title-pattern semantics, and weekly-pattern caveats (`gggg` vs `YYYY`).

### UI rendering (Svelte 5)

`JournalHeaderFeature` registers a `journal-header` code block processor that resolves settings, builds a `JournalNote`, builds a plain `JournalHeaderInfo`, and mounts `JournalHeader` via Svelte 5's `mount` API. The primary row shows `back ‹‹ More... · Today · ›› forward`; everything else lives in the More popover, which is **portaled to `<body>`** to escape CodeMirror live-preview widget clipping. Errors render via `ErrorMessage.svelte` rather than throwing.

See [docs/header-ui.md](docs/header-ui.md) for the popover positioning logic, the delegated `findInternalLinkHref` click handler (necessary because Obsidian's `.internal-link` interception doesn't fire on portaled content), and the secondary-list date-pattern derivation in `secondaryTitlePatternFor`.

### Calendar picker

`JournalCalendar.svelte` renders below the options bar inside the same sticky header when `calendarVisible` is true. The pure model lives in `journal-calendar-info.ts` (`buildCalendarInfo`) and is fully unit-tested. A controls strip above the months grid carries **Today** and a `{Month} {Year}` link that toggles a portaled date-picker popover (year chevrons + 4×3 month grid). Pure helpers for the controls/picker live in `calendar-navigation.ts`.

See [docs/calendar.md](docs/calendar.md) for the deep details: month-window placement and `pickVisibleMonthCount` constants, fixed-width day cells, the dedicated divider grid track, cell-class stamping (and why we don't trust Obsidian's link-resolution pass), the date-picker popover behaviour, the desktop/mobile spacing split, and the platform-specific visibility defaults.

### Folder layout

```
src/
  plugin/         # plugin entry + feature lifecycle multiplexer
  data-access/    # settings types, FolderSettingsResolver, JournalNote, PluginFeature base
  features/       # one folder per feature; each owns its own *-feature.ts and any Svelte components
  ui/             # shared Svelte components (NoteLink, ErrorMessage)
docs/             # architecture deep-dives, screenshots, demo vault, screenshot harness
```

Within `data-access`, every module is re-exported from `index.ts`; features import from `'src/data-access'` (path alias via `tsconfig` `baseUrl: '.'`) or relative paths. esbuild bundles `.svelte` files via `esbuild-svelte` with `css: 'injected'`; `styles.css` is the only CSS shipped separately (Obsidian loads it alongside `main.js`).

## Release

Releases are driven by git tags. `.github/workflows/release.yml` runs `npm run build` on tag push and creates a draft GitHub release with `main.js`, `manifest.json`, and `styles.css` attached. Use `npm version <patch|minor|major>` — the `version` script syncs `manifest.json` + `versions.json` and stages them automatically.

## Conventions worth honoring

- Prettier: single quotes, 2-space indent, no semicolons, trailing commas `es5`, 80-col print width.
- License headers: every `.ts`/`.svelte` source file starts with the GPL-3.0 boilerplate. Match the existing style when adding new files.
- Date formatting always goes through Obsidian's bundled moment (`import { moment } from 'obsidian'`).
- The settings tab (`journal-folder-settings-tab.ts`) is explicitly marked as throwaway code in a comment — don't be surprised by its shape.
