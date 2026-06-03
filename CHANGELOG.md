# Changelog

All notable user-facing changes to **Journal Folder** are documented here.

The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each release heading must be `## [x.y.z]` (the release workflow extracts the
section between that heading and the next `## [` to populate the GitHub
release body).

## [Unreleased]

### Added
- **Task management.** Surfaces Markdown tasks from journal notes in two new
  places: a *Tasks* panel below the sidebar's calendar, and an in-note
  `journal-tasks` code block (analogous to `journal-header`).
  - Two task models behind a shared interface: **Simple** (`[ ]` ↔ `[x]`)
    and **Bullet Journal** (`[ ] [/] [x] [>] [-]`, with `[>]` migrated and
    `[-]` cancelled treated as done for filtering). Pick one in
    *Settings → Tasks → Task model*.
  - **Square / circle** checkbox styling — purely cosmetic, swaps the
    Lucide icon variant used for every status.
  - Sidebar quick toggles below the *TASKS* heading: a reference-range
    link (label reads **Today** or **Dynamic** to match the current
    mode) and a completed-filter link (**All tasks** or **Active
    tasks**). Both write back to global settings; a **Folders** link
    narrows the *Today* scope to a subset of folders (hidden in
    Dynamic mode since the scope follows the active note there).
  - In-note block accepts `folders:`, `units:`, `show-completed:`, and
    `max-items:` keys. `show-completed` is view-local and does not
    persist.
  - Left-click the status icon to cycle to the next status; right-click
    (or long-press) opens a status menu with every option in the active
    model. Writes go through `vault.process` with a line-match guard so
    a stale cache aborts safely with a Notice.
  - `tasksMaxItems` cap (default **200**) with a "Showing N of M —
    increase limit in settings" footer when truncated.
  - **Cycle / render document tasks** (off by default). When enabled,
    every task checkbox in the rendered document is replaced with the
    same status icon used in the panel: left-click cycles, and unusual
    statuses (`[/]`, `[>]`, `[-]`) render their proper icon variant
    rather than falling back to Obsidian's default checkbox. Works
    in **reading view** (markdown post-processor) and **live preview**
    (DOM `MutationObserver` that swaps the native checkbox inline as
    soon as Obsidian renders it — Obsidian's checkbox lives in the
    rendered widget layer rather than the CodeMirror source range,
    so a source-level decoration can't suppress it); source mode is
    left untouched so raw markdown stays editable. In the editor the
    right-click status options integrate into Obsidian's native
    editor context menu rather than overriding it. The toggle lives
    in *Settings → Tasks → Cycle / render document tasks*; leave it
    off if another plugin (e.g. Tasks) already owns in-document
    interactions.
  - **Status icon rendering** (dropdown, default *Plugin icons*).
    Pick *Theme checkbox* to keep Obsidian's native checkbox visible
    so the active theme (Minimal / Things / AnuPpuccin / …) paints
    it — the plugin still owns left-click cycle and right-click
    menu. The parent `<li>`'s `data-task` attribute is mirrored
    from the parsed status in both modes so theme rules keyed on
    it keep firing for non-standard statuses (`[/]`, `[>]`, `[-]`).
    Applies to the sidebar task panel and the in-note
    `journal-tasks` block too: in theme mode each row renders an
    actual `input.task-list-item-checkbox[data-task="X"]` inside
    a `.task-list-item` row inside a `.contains-task-list`
    wrapper, so theme rules that scope to those selectors apply.

## [2.1.1]

### Changed
- **Dependency upgrades.** Bumped `svelte` to 5.55.7 (resolves SSR XSS
  advisories GHSA-pr6f-5x2q-rwfp and GHSA-f3cj-j4f6-wq85, plus the transitive
  `devalue` advisory GHSA-77vg-94rm-hx3p) along with patch/minor bumps to
  `@types/node`, `@typescript-eslint/*`, `builtin-modules`, `esbuild-svelte`,
  and `vitest`. No user-facing behavioural changes.

## [2.1.0]

### Added
- **Per-tier auto-templates.** New journal notes can be auto-seeded with
  template content the moment they're created — no Templater required. Off by
  default; enable globally via *New-note template → Auto-fill new journal
  notes*, or per-folder via `auto-template-enabled: true` in
  `journal-folder.md`. Each tier (daily / weekly / monthly / quarterly /
  yearly) gets its own template body. Only empty new files matching a journal
  pattern are touched.
- **Per-folder configuration is now the default editing surface.** The
  *Edit folder configuration* modal is the recommended way to tweak a single
  folder's behaviour without hand-editing front matter.

## [2.0.0]

### Added
- **Journal Folder sidebar.** A dedicated docked view, opened from the new
  *calendar-days* ribbon icon. It owns:
  - a folder picker for jumping between journal folders,
  - an embedded single-month calendar bound to the selected folder,
  - a **More…** menu with: switch to default folder, set as default, edit
    folder configuration, and **Initialise a new journal folder**,
  - two modes — **Dynamic** (calendar follows the active note) and **Static**
    (calendar stays put), shown in the header label as
    `JOURNAL FOLDER (Dynamic | Static)`.
- **Initialise a new journal folder** action — pick any non-journal folder and
  the plugin seeds it with a `journal-folder.md` (pre-filled with
  `journal-folder-title: <folder name>`).
- **Edit folder configuration modal.** Mirrors the plugin's settings UI but
  writes to the selected folder's `journal-folder.md` front matter. Fields
  equal to the global setting are stored only when they diverge, so future
  global tweaks still flow through. Uses Obsidian's wide settings-dialog
  styling.
- **Hide `journal-folder.md` in the file explorer** — new global toggle.
- **Sidebar mode** and **Default journal folder** global settings.

### Fixed
- **Sidebar crash on first render** — `Cannot read properties of undefined
  (reading 'lastIndexOf')` when opening the calendar view.

## [1.6.1]

### Fixed
- **Plugin no longer appears twice in *Community plugins* after an in-place
  update.** The disable/enable cycle Obsidian runs on update now properly
  tears down the previous instance.

## [1.6.0]

### Added
- **Start of week** setting (Locale default / Sunday – Saturday). Aligns the
  calendar grid and `gggg-[W]ww` weekly note numbering to your preferred week
  start. Global only — moment's locale is process-wide and per-folder
  overrides would create inconsistent week numbering across the vault.

### Changed
- **Settings tab redesigned into sections** — *General → Calendar → Note
  title patterns → Reset*, with per-tier sub-headings. The shared
  pattern-syntax guidance now lives once at the section level instead of
  being repeated under every row.
- **Friendlier reset confirmation** — destructive *Reset all to default
  values* now opens an Obsidian-themed modal instead of the browser-native
  `confirm()` dialog.

## [1.5.0]

### Added
- **Quarterly notes — opt-in fifth tier.** Filenames matching `YYYY-Q[1-4]`
  are recognised as quarterly entries when `quartersEnabled` is on. They slot
  between yearly and monthly: yearly notes show a Quarter section in the More
  popover; daily/weekly/monthly notes get a containing-quarter chip in
  *Jump to*; the calendar marks each month with `(Q1)`–`(Q4)`. Default title
  format: `2026 Quarter 2`.
- **Past + missing links are clickable everywhere.** Past dates without notes
  used to be plain text in the More popover. They now render as faded links
  and prompt to create the note, matching the calendar's behaviour.

## [1.4.1]

### Fixed
- Internal `package.json` / `versions.json` metadata cleanup so future
  `npm version` bumps stay consistent. No user-visible behavioural changes.

## [1.4.0]

### Added
- **Calendar picker + quick-nav strip.** A new **Year/Month** date picker
  replaces wandering through prev/next chips. Year ‹/› chevrons jump 12
  months at a time, then click any month in a 4×3 grid to land on it. Two
  context-aware quick links sit alongside it:
  - **Current** — only shown when today isn't already visible,
  - **Note month** — only shown when the host note's month isn't visible.
- **More popover.** Higher-order chips and the lower-order list collapsed
  into a clean popover behind a single **More…** link, leaving back / Today /
  forward on the primary row. Sections carry uppercase labels (`Jump to`,
  `Day`, `Week`, `Month`, `Year`).
- **Mobile-friendly calendar.** Bigger tap targets, larger cells/arrows on
  Obsidian Mobile while desktop keeps its tighter layout.
- **Default calendar visible** is now split into separate **desktop** and
  **mobile** settings.

### Changed
- **Calendar visible by default for new installs.** Per-folder and embedded
  overrides still win.
- **Three months fit at default note width** on desktop.
- **Theme-aware calendar cells.** Existing notes underlined; current/future
  periods use the theme accent; past + missing cells are demoted; Sundays
  carry a permanent accent.
