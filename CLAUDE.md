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
4. `mount(JournalHeader, { target: el, props: { info, note, confirmCreate, navigate, defaultCalendarVisible } })` — Svelte 5 `mount` API, components use runes (`$props()`). The feature also constructs a `confirmCreate` (opens the `ConfirmCreateModal`) and a `navigate` callback (`workspace.openLinkText`) so the calendar can intercept clicks on past-missing cells without losing native link behavior elsewhere.

Errors are caught and rendered via the `ErrorMessage.svelte` component instead of being thrown.

The primary row shows only `back ‹‹ More... · Today · ›› forward`. Everything else lives in the **More popover**: a "View" section header with the higher-order chips below it and a "Show calendar" / "Hide calendar" link right-aligned on the same row, plus a separate lower-order section ("Day"/"Week"/"Month"/"Year"). The popover is **portaled to `document.body`** when open and positioned with `getBoundingClientRect()` on the options bar; this is intentional — in live-preview mode the CodeMirror widget wrapping the code block clips absolutely-positioned descendants, so the panel has to escape the widget's containing block. Repositioning runs on window resize and on capture-phase `scroll` events (the editor pane scrolls separately from the window).

Because the panel is portaled out of the markdown render container, Obsidian's `.internal-link` click interception no longer fires on its links (that handler is scoped to the rendered markdown). The panel installs its own delegated `onclick` that uses `findInternalLinkHref` (in `internal-link-target.ts`) to walk up to the nearest `<a class="internal-link">`, then closes the popover and routes the href through the injected `navigate` callback — the same callback the calendar uses for past-missing cells. Primary-row chips don't need this: they stay inside the rendered markdown container where Obsidian's handler still fires.

Secondary list date patterns are derived from the lower-order `timeUnit` and use non-breaking spaces; they intentionally drop the year because the H1 already shows it. Don't reach for the user-configured `titlePattern`/`shortTitlePattern` for these — see `secondaryTitlePatternFor` in `journal-header-info.ts`.

### Calendar picker

`JournalCalendar.svelte` renders below the options bar inside the same sticky header when `calendarVisible` is true. The pure model lives in `journal-calendar-info.ts` (`buildCalendarInfo(note, { visibleMonthCount, offsetMonths })`) and is fully unit-tested — it owns no DOM or IO. Per month: clickable `MMM` + `YYYY` title, weekday header row, locale week-number column on the left, and a 6×7 day grid (rows that are entirely outside-month are skipped, and individual outside-month days inside otherwise-populated rows are rendered as empty placeholders). Default month-window placement is right-biased: `monthsBefore = floor(N/2)`. The component measures its container with a ResizeObserver and feeds the width into `pickVisibleMonthCount(width, { isMobile })` (in `visible-month-count.ts`, capped at `MAX_MONTHS = 5`); desktop uses 220px per slot, mobile 340px — both bake in the inter-month gap so `floor(available / minMonthPx)` slightly *over*-reserves rather than under-reserves, preventing the picker from returning a count whose fixed-width grids would overflow their containers. Each `.journal-folder-calendar-month` is `flex-shrink: 0` for the same reason: the cells inside don't shrink, so the month container must not shrink either, otherwise the grid would visually leak into the next month. Arrow buttons (using Obsidian's `clickable-icon` class for theme conformance) shift `offsetMonths` by ±1.

Mobile vs desktop is decided at mount time from `Platform.isMobile` (Obsidian's runtime constant) and threaded as an `isMobile` prop down through `JournalHeader` to the calendar; the calendar applies a `.is-mobile` class on its root and CSS scopes the enlarged cell sizing under that class so desktop styling stays exactly as it was.

Day cells use a fixed track width — `1.32rem` on desktop, `1.8rem` on mobile — rather than the original `1fr` or a `minmax(0, …)` cap. Fixing the width keeps the column spacing identical regardless of how much pane room each month gets, which the user wanted after seeing cells stretch and shrink as `pickVisibleMonthCount` swapped between 1-up and N-up layouts. Months are slightly wider than `pickVisibleMonthCount`'s `DESKTOP_MIN_MONTH_PX = 180`, so in extremely narrow editors a calendar can horizontally overflow its month container — acceptable trade for visually consistent column spacing across all configurations. A 1px vertical divider sits between the week-number column and the weekday columns via a dedicated `.35rem`-wide grid track (`.5rem` on mobile) containing a centred `.journal-folder-calendar-divider` element that spans `grid-row: 1 / -1`. The divider only resolves correctly if the grid has an *explicit* row template (otherwise `-1` collapses to `1` and auto-flow leaks day cells into column 2 on subsequent rows), so `JournalCalendar.svelte` computes `renderedWeekCount` per month and writes `grid-template-rows: repeat(renderedWeekCount + 1, auto)` as an inline style — the count must be exact rather than a static `repeat(7, …)` because the trailing `row-gap: 1px` would otherwise leave 1–2px of phantom space below short months. The `.journal-folder-calendar-months` container uses `display: flex; justify-content: center` rather than equal-share grid columns so the visible months cluster in the middle of the pane instead of fanning out across the full width when fewer months are shown than would fit.

Cell classes are stamped by `calendarCellClasses` in `calendar-cell-classes.ts` (extracted from the Svelte component so it's unit-testable) and crucially the `is-unresolved` decision is made from the plugin's own `cell.exists` rather than left to Obsidian's link-resolution pass. Obsidian only stamps `is-unresolved` on internal-link cells present during the initial markdown render — but the calendar progressively inserts months as the ResizeObserver settles (initial `measuredWidth = 0` yields a `visibleMonthCount` of 1, then a real measurement bumps it up) and arrow-scroll inserts new months on demand. Cells inserted after the post-processor returns never get Obsidian's stamp, so missing cells in those months would render at full opacity while missing cells in the initially-rendered month would render at the theme's reduced unresolved-link opacity — visually inconsistent across months. Stamping the class ourselves makes the behaviour uniform regardless of insertion timing. CSS overrides Obsidian's `.internal-link` color with `!important` so cells render in the theme accent regardless of resolved state, but lets the theme own `opacity` on `is-unresolved` cells so missing cells fade per the active theme. The full styling hierarchy: past-missing → `--text-faint` italic; non-past missing → `--text-accent` + `is-unresolved` opacity; existing → `--text-accent` + bold + underlined; today gets an accent ring; the cell that exactly matches the open note gets the accent fill. Past-missing clicks are intercepted via `event.preventDefault()` + an Obsidian `Modal` (see `confirm-create-modal.ts`) that resolves a `Promise<boolean>`; on confirm we navigate manually via the injected `navigate` callback (Obsidian's link interception is async-incompatible).

Visibility is shared via a Svelte writable in `calendar-visibility.ts`. The store is in-memory only (resets on Obsidian restart). The `defaultCalendarVisible` setting flows through the standard 3-layer resolution; on each header mount, `applyCalendarDefault(value)` syncs the store to the resolved default — but a session-scoped `userHasToggled` flag, set the first time the user clicks the toggle, makes `applyCalendarDefault` a no-op for the rest of the session so navigating between folders with different defaults doesn't override an explicit user choice. Boolean coercion for the resolved value uses `isTruthy` in `journal-header-feature.ts` so the literal string `"false"` from embedded `key: value` configs is honored as false (front-matter values arrive as real YAML booleans and don't need this).

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
