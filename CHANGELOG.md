# Changelog

All notable user-facing changes to **Journal Folder** are documented here.

The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each release heading must be `## [x.y.z]` (the release workflow extracts the
section between that heading and the next `## [` to populate the GitHub
release body).

## [2.3.0]

### Added
- **Task scope panel.** The sidebar task panels (both the combined
  sidebar's panel and the Tasks-only sidebar) now choose what to show
  through a single popover opened from a **Scope ▾** link on the right
  of the `TASKS` header. It has four sections:
  - **Anchor** — *Today* or *Current note* (the journal note you're
    reading; falls back to today on a non-journal leaf).
  - **Range** — *Day / Week / Month / Quarter / Year*, or *All* for no
    date filter. The range is the calendar period of that size around
    the anchor, so e.g. *Today + Week* = this week and *Current note +
    Month* = the month containing the active note. *Quarter* appears
    only when quarterly notes are enabled.
  - **In folders** — *Current note's folder*, *All journal folders*, or
    a single specific folder. Independent of the anchor.
  - **Filter** — show/hide completed tasks.
- **Scope summary line.** A read-only line under the panel header shows
  the active selection at a glance (`Anchor · Range · Folders · Filter`,
  e.g. `Today · Week · All folders · Active`) so you can see it without
  opening the panel.

### Changed
- The sidebar **More...** menu now uses the same styled popover as the
  task scope panel instead of the native context menu. (The folder
  picker dropdown is unchanged.)
- The task panel's old *Today / Dynamic* toggle and separate folders
  menu are replaced by the scope panel above. Existing settings migrate
  automatically: *Dynamic* becomes a *Current note* anchor with a *Day*
  range; a previously chosen scope folder becomes a *specific folder*
  selection. The combined and Tasks-only sidebars now keep fully
  independent scope selections.

## [2.2.0]

### Added
- **Task management** — a new top-level surface that aggregates Markdown
  tasks from journal notes in three places: a **Tasks** panel under the
  combined sidebar's calendar, a slim **Tasks-only sidebar** (separate
  view, opens via the *list-checks* ribbon), and an in-note
  **`journal-tasks` code block**. All three share a single cache and
  re-render on every vault edit, so a task ticked off anywhere updates
  everywhere immediately.
- **Named task flows.** A flow is a named set of statuses (label,
  on-disk character, *active / done* bit, cycle target, and visuals).
  Built-in starting templates (Simple, Kanban, Bullet Journal, GTD)
  live in code and are *read-only* — pick one to seed a new flow, then
  customise. Each folder can pick its own flow via `task-flow:` in
  front matter, or inherit the global default. Manage flows from a
  drill-down UI in *Settings → Tasks* (overview → flow detail → status
  detail) with drag-reorder, breadcrumb navigation, and confirm prompts
  on destructive actions (apply template, delete flow, remove status).
- **Per-status visuals.** A status can render with a custom shell
  (none / circle / square / rounded square), background + border colours
  pulled from Obsidian's theme tokens (so it follows light/dark mode),
  and an inner icon from Lucide, an emoji, an image URL, or sanitised
  raw SVG.
- **Plugin or theme checkbox rendering**, picked **per flow**. Plugin
  rendering paints the custom shell + icon defined per status; theme
  rendering leaves Obsidian's native checkbox visible so the active
  theme (Minimal, Things, AnuPpuccin, …) styles it via `data-task` —
  the plugin still owns left-click cycle and right-click menu in both
  modes. One mode per flow because mixing inside one nested list paints
  unreliably across themes.
- **Document task interactions** (*Settings → Tasks → Task interactions*,
  default *Plugin task lists only*). Opt in to *Everywhere in document*
  to make every task checkbox in reading view and live preview cycle
  through the active flow; status options also fold into Obsidian's
  native editor context menu. Leave it on the default if another
  plugin (e.g. Tasks) already owns in-document interactions.
- **Sidebar quick toggles** below the *TASKS* heading: a reference-mode
  link that reads **Today** or **Dynamic** (Dynamic follows the active
  journal note's range), a completed filter, and a folder scope picker
  (hidden in Dynamic mode since the scope already follows the active
  note). The combined sidebar and tasks-only sidebar each track their
  own reference mode.
- **`journal-tasks` code block** accepting `folders:`, `units:`,
  `show-completed:`, `max-items:`, and `caption:` keys. The
  `show-completed` toggle is view-local and does not persist.
- `tasksMaxItems` cap (default **200**) with a *Showing N of M* footer
  when truncated.

### Fixed
- The combined sidebar's task-panel completed-hidden count is now
  reported against the full pre-cap set, not just the slice that
  survived the truncation cap.
- Document task processor no longer leaves a stale click handler bound
  to a checkbox after Obsidian re-renders a section — the next click
  could otherwise write the new status to a different line if the
  source had shifted in the meantime.
- `journal-tasks` `show-completed:` typos (e.g. `treu`) now leave the
  flag unset instead of silently treating the typo as truthy.

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
