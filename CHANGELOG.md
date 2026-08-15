# Changelog

All notable user-facing changes to **Journal Folder** are documented here.

The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each release heading must be `## [x.y.z]` (the release workflow extracts the
section between that heading and the next `## [` to populate the GitHub
release body).

## [3.5.0]

### Changed
- **Native settings, findable through search.** The plugin settings now render
  through Obsidian's declarative settings framework (Obsidian 1.13+): grouped
  sections up top (General, Sidebar, Today, Calendar) and drill-in sub-pages
  for *New-note template*, *Note title patterns*, *Tasks* (with nested *Task
  flows* and *Task categories* pages), and *Signifiers*. Every option is now
  indexed by Obsidian's settings **search**, so you can jump straight to a
  setting by name. The task-flow → status drill-down and its breadcrumbs work
  as before, one level deeper under *Tasks → Task flows*.
- **The per-folder configuration modal matches the settings tab.** *More… →
  Edit folder configuration* now uses the same native grouped layout and the
  same drill-in flow (sub-pages with a back header) as the global settings,
  instead of the previous custom tab strip. Every field keeps its explicit
  *Default (inherit the global value)* choice, and the modal holds a fixed
  height while navigating.
- **Minimum Obsidian version is now 1.13.0** (previously 1.7.2), required by
  the declarative settings API. Destructive buttons (reset, delete flow)
  now use Obsidian's native destructive styling.

### Removed
- The per-setting reset-to-default buttons on simple toggles/dropdowns in the
  global tab (the declarative framework doesn't support them). Date-pattern
  fields keep their reset buttons, and the *Reset all to default values*
  action remains.

## [3.4.0]

### Added
- **Migration heading level.** When task-migration placement is *Under a
  heading* and that heading doesn't exist yet, it's now created at a level you
  choose (H1–H6) instead of always H2. The new *Migration heading level*
  setting sits next to *Migration heading* and, like it, can be overridden
  per folder (`task-migration-heading-level`). It only governs heading
  *creation* — when a heading of that text already exists, tasks still slot
  under it at its current level.
- **Per-folder "Default" (inherit) choice.** In *More… → Edit folder
  configuration*, every overridable setting now shows inheriting-from-global as
  an explicit option instead of leaving you to guess: dropdowns gain a
  *Default (&lt;value&gt;)* entry, toggles become *Default / On / Off*, and text
  and date-pattern fields sit behind a *Default / Custom* selector that only
  reveals the input under *Custom*. Picking *Default* clears the folder's
  override, so the folder tracks future global edits again.

### Fixed
- **Clicking a task icon on a collapsible task no longer folds the list.** In
  reading view, a task with sub-items is collapsible and Obsidian draws its fold
  control over the checkbox column; clicks on the plugin's status icon landed on
  that control (toggling the sub-list) instead of cycling the status, and the two
  glyphs visibly overlapped. The icon now paints above it and owns its clicks,
  while the fold control still folds on its exposed left edge.
- **Clicking the gap next to a task icon in Live Preview no longer drops the line
  into source view.** The space between the status icon and the task text fell
  through to the editor and placed the caret; that gap is now part of the icon's
  hit target and cycles the status like the icon itself.

### Documentation
- Added a **Known issues** section to the README covering the two cosmetic
  margin-icon overlaps we're aware of (Obsidian's fold arrows, and the editor's
  optional line numbers), including which one is on the planned-fix list and why
  the other isn't.

## [3.3.0]

### Added
- **Edit-mode indicator.** A new optional setting (Settings → Journal Folder →
  General → *Edit-mode indicator*, off by default) draws a thin coloured rule
  down the left edge of the editor so it's obvious at a glance whether a note is
  being edited or read: an accent rule in Live Preview, a muted-grey rule in
  Source mode, and nothing in reading view. It follows your theme's colours,
  adds no layout shift, and applies to every note in the vault.

### Changed
- Updated the build toolchain and dependencies (TypeScript 6, Svelte, Vitest,
  esbuild, typescript-eslint, and others). No behavioural change.

## [3.2.1]

### Fixed
- **Tasks inside code blocks are no longer parsed as tasks.** A line like
  `- [ ] example` inside a fenced code block used to show up in the task
  lists, and cycling its status could rewrite a line *inside* the code block.
  Fenced lines are now skipped everywhere tasks are scanned.
- **Popout windows render plugin popovers correctly.** The header's More
  popover, the calendar's date picker, and the task status picker now open in
  the popout window they belong to (and clamp to its viewport) instead of the
  main window.
- **Settings changes no longer re-render unrelated views.** Toggling a sidebar
  option such as *Show completed* used to clear the whole task cache and
  re-render every open reading view; invalidation is now scoped to what the
  changed setting actually affects.
- **Sidebar task counts are consistent.** Hidden completed tasks no longer
  consume list-cap slots, and the header count always matches the truncation
  footer.
- **Sidebar panels position correctly on first open** (the More... menu and
  scope panels could briefly mis-position before).
- **Embedded code-block config values are type-coerced.** Numeric and boolean
  `key: value` overrides in a `journal-header` block now parse by the field's
  type instead of being taken as raw strings.
- **Task migration guards against a same-note destination**, and a settings
  change saved while the one-time template migration ran is no longer
  overwritten.

### Performance
- The sidebar now reacts only to vault changes that affect its scope
  (filtered + debounced) instead of recomputing on every vault event, and
  large journal folders no longer pay a quadratic sibling scan. Cold
  task-cache reads are pooled, and live preview skips decoration rebuilds in
  documents without migration markers.

### Internal
- Release assets now ship with GitHub artifact attestations.
- CSS cleanups for the community-review scanner: `gap` shorthand instead of
  `column-gap`, an `@supports` fallback instead of a duplicate `height`
  declaration, and a class stamp instead of a `:has()` selector in the header.
- ESLint now covers `.svelte` sources with the same type-aware
  community-review ruleset.

## [3.2.0]

### Added
- **New "Start a new line below" command.** Starts a fresh line below the one
  your cursor is on — exactly as if you had pressed Enter at the **end** of that
  line — so you can begin a new entry without first moving to the line's end. In
  a bullet, checkbox, or blockquote it continues the list natively (and exits an
  empty item) just like a real Enter, because it hands off to Obsidian's own
  newline handling rather than reimplementing it. The command ships without a
  default shortcut; bind it (for example to Ctrl/Cmd+Enter) under
  **Settings → Hotkeys**, the same as the plugin's other commands.

## [3.1.6]

### Fixed
- **Signifiers now appear in vaults upgraded from an early version.** A vault
  that still had a long-removed signifier placement saved (`start` or `end`,
  from when there were four placement options) would silently render **no**
  signifier icons — the icon was positioned off-screen and its tag hidden, so
  nothing showed. Such vaults now migrate automatically to the default
  single-column placement on load, and the icons reappear.
- **Signifiers on headings no longer float above the text.** A heading line
  carries extra top-padding (Obsidian gives headings `padding-top` in the
  editor; some themes add more), and the margin icon was anchored to the top of
  that padded box, so it hovered ~16px above the heading. The icon's vertical
  position is now measured from the line's actual text, so it sits centred on
  the heading in both Live Preview and reading view.
- **Per-entry signifiers line up with the bullet under the Outliner plugin.**
  In the per-entry (`margin`) placement the Live Preview icon was anchored to a
  text coordinate that sits ~one indent step right of the rendered bullet
  (further off when Outliner restyles lists), so the icon drifted away from its
  entry. It now anchors on the bullet itself and hangs a consistent gap to its
  left at every nesting depth.

## [3.1.5]

### Internal
- No user-facing changes — the plugin itself is unchanged from 3.1.4. This
  release is repository housekeeping.
- Removed the per-release end-to-end **verification report** (the committed
  `docs/test-reports/` gallery). Regenerating ~74 screenshots on every release
  was ballooning the repository's git history with binary churn, so the report
  was dropped — it is no longer generated, committed, or linked from the README.
  The README's own screenshots are unaffected, and the end-to-end suite still
  verifies every release; it simply no longer captures a document.
- Hardened the release script so the expected deploy-artifact churn from the E2E
  and screenshot steps can no longer halt a release at the version-bump step.

## [3.1.4]

### Fixed
- **Source mode is now a raw editing experience.** Signifier tags were being
  hidden (and gutter icons drawn) even in plain Source mode; now the signifier
  rendering applies only in Live Preview and reading view, so Source mode shows
  your markdown — tags included — exactly as typed.
- **Migration-reference icons now render while editing.** A `lucide:` migration
  marker (e.g. `lucide:redo-dot`) is rendered as its icon in Live Preview too
  (previously only in reading view), and is left as the literal token in Source
  mode for editing.

### Internal
- Removed every `!important` from `styles.css` (22 declarations), replacing them
  with higher-specificity selectors — including the calendar colour-lock. No
  visual change; verified against the AnuPpuccin theme. Clears the community
  review's "Avoid `!important`" findings.
- Dropped the `builtin-modules` dev dependency in favour of Node's native
  `module.builtinModules` in the esbuild config, and added a reason to the lone
  `eslint-disable` directive in `journal-folder-settings-store.type.ts` — both
  community-review findings.

## [3.1.3]

### Changed
- Reworked how the task **scope** turns into a date filter. The anchor is now a
  genuine date *range* — *Today* is a single day, *Current note* is the note's
  whole period — and the selected **range** includes every calendar period of
  that size that overlaps the anchor. This fixes wrong results when period
  boundaries didn't line up (e.g. a monthly note viewed with range *Week* now
  correctly includes every week the month touches). Category range caps are
  measured the same way. No settings change is needed.

## [3.1.2]

Maintenance release — release-tooling and documentation work only. No new
features, no behaviour changes, and the shipped plugin (`main.js`) is unchanged
from 3.1.1.

### Internal
- Added a **release verification report**: the end-to-end test suite now runs in a
  `--report` mode that records each scenario and captures a screenshot from the
  live Obsidian run, producing a committed, browsable document
  (`docs/test-reports/`, linked from the README) — both evidence of what each
  release verified and a guided tour of the plugin in action. Off by default, so
  ordinary test runs stay fast.
- Added a **local release pipeline** (`npm run release`) that runs lint, unit
  tests, build, the E2E suite with the verification report, screenshots, the
  version bump, deploy, and the tagged push in one halt-on-failure sequence; the
  tag still produces a draft GitHub release to review and publish.
- Hardened the E2E CLI transport against empty-stdout transients (a focus race the
  screenshot step exposed), so the live suite runs green in report mode.

## [3.1.1]

Maintenance release — code-quality and tooling work, no new features and no
behaviour changes for users on a supported Obsidian.

### Changed
- **Raised `minAppVersion` to 1.7.2** to honestly reflect the Obsidian APIs the
  plugin already uses (e.g. `Workspace.revealLeaf`). Installs on older Obsidian
  were already relying on newer-than-declared APIs; this just makes the manifest
  truthful.

### Internal
- Adopted **`eslint-plugin-obsidianmd`** — the same ruleset the community-review
  scanner runs — as standard tooling (`npm run lint`), and cleaned the codebase
  to **zero** lint problems. This addresses the automated-scan cautions on the
  community plugins page.
- Hardened against unhandled promise rejections (`void`/await on fire-and-forget
  calls), and switched DOM access to `activeDocument` / `activeWindow` for
  popout-window compatibility.
- Introduced a typed `moment` wrapper so date code is fully type-checked.
- Moved hard-coded inline styles (task-status icon shapes, checkbox swapping,
  settings inputs, colour-swatch states) into stylesheet rules — rendering is
  unchanged, verified in live Obsidian.

## [3.1.0]

### Changed
- **Templates are now notes, not settings text.** New-note templates live as
  ordinary notes with standardized filenames — `daily-template.md`,
  `weekly-template.md`, `monthly-template.md`, `quarterly-template.md`,
  `yearly-template.md`, and `default-template.md` as a fallback — kept in a
  configurable **template folder** (default `Templates/journal-folder`). A
  per-journal **override subfolder** (default `Templates`, relative to each
  journal folder) takes precedence for that folder. Template bodies are copied
  verbatim, front matter included.
- Legacy inline template text is **migrated automatically** into template notes
  on first launch; the old `data.json` values are kept as a backup and
  `journal-folder.md` bodies still work as a legacy template source.

### Added
- **Live template preview.** Opening a template note that contains a
  `journal-header` block renders it as the current period's entry — header,
  calendar, and signifiers — marked with a corner **TEMPLATE** ribbon. The
  preview's navigation links and calendar cells are display-only (they resolve
  to the template note itself instead of navigating to real journal notes).
- **Create template files** button in the settings tab scaffolds any missing
  standardized template notes.
- **Re-populate note from template** — a new action in the sidebar **More...**
  menu (shown only when the active note is a journal note in a
  templating-enabled folder) re-applies the note's template, overwriting its
  contents. It asks for confirmation first, since it's destructive.

### Fixed
- **Current-day calendar cell is readable on Sundays.** When the current note
  fell on a Sunday, the cell kept the Sunday accent text colour on its accent
  highlight background, making the date invisible. It now uses on-accent
  (white) text like every other weekday, in both the in-note and sidebar
  calendars.

## [3.0.1]

### Fixed
- **Add signifier / Add category** — clicking *Add signifier* or *Add category*
  in the settings tab now correctly persists the new item. Previously the edit
  modal that opens after the initial save was calling `getSettings()` against a
  stale pre-render snapshot, causing its own save to overwrite the freshly-added
  item with the old empty list.

## [3.0.0]

Major-version milestone. The last month added a lot — bullet-journal
**signifiers**, the single **plugin menu**, user-defined **task flows** with
theme-aware checkbox rendering, **task migration**, **task categories**, and now
the **status picker** and per-category **range caps** below. The version bump
marks that body of work; the changes specific to this release are:

### Added
- **Status picker.** Right-click (or long-press) a task's status icon to open the
  plugin's own picker panel — every status in the flow with the current one
  highlighted, plus a **Migrate task…** action for active tasks in
  migration-capable notes. It replaces Obsidian's native right-click menu and
  appears the same way across the sidebar panels, `journal-tasks` blocks, and
  (with `task-interaction-scope: everywhere`) document checkboxes in reading view
  and live preview. A status whose **Next status** points at *itself* becomes a
  "pick on click" status — left-clicking opens the picker instead of cycling.
- **Task category range caps.** A task category can be pinned to a **Maximum
  range** (Day / Week / Month / Quarter / Year). Its tasks then reach no further
  than that range from the list's anchor — a larger list range (or *All*) clamps
  to the cap, a smaller range still wins, and the smallest cap wins when a task is
  in several capped categories. Handy for keeping day-local chores out of wider
  rollups.

### Changed
- **Note-anchored task lists honour the note's own range as a floor.** When a list
  is measured from a note — the sidebar's *Current note* anchor and every in-note
  `journal-tasks` block — neither the range nor a category cap can be finer than
  the note's own tier. Viewing a monthly note shows the whole month, not just its
  first day, since a note spans a date range rather than a single anchor instant.
- **The task status right-click affordance is now the plugin's own panel**, not
  Obsidian's native menu (the native menu remains only where the plugin extends
  Obsidian's editor context menu).

## [2.5.2]

### Changed
- **The header's previous/next chip now becomes *Today* when it points at
  today.** When the day either side of the current note is today, that arrow's
  chip reads *Today* and the separate *Today* button is dropped (it pointed at
  the same note) — one less redundant button in the primary row.

### Fixed
- **Converting an empty bullet to a task no longer duplicates the bullet.**
  Running *Toggle task / advance status on current line* on a bare `-`, `*`, or
  `+` (a list item you've only just started) now reuses that bullet instead of
  producing `- [ ] -`.

## [2.5.1]

### Changed
- **Docs:** the *journal-header* tip now leads with the plugin's built-in
  *Auto-fill new journal notes* feature (no extra plugins, journal-aware
  per-folder / per-tier templates), with Templater and the core Templates plugin
  noted only as alternatives. Documentation-only release.

## [2.5.0]

### Added
- **A plugin menu.** A single ribbon icon — *Journal Folder menu* — now opens a
  quick-action menu: a light/dark switch, *Open Journal Folder sidebar*, *Open
  Journal Tasks sidebar*, and *Initialise a new journal folder*. An **Open
  Journal Folder menu** command opens the same menu, which is the way to reach it
  on mobile (Obsidian has no ribbon there — pin the command to the toolbar). On a
  phone the menu opens as a centred sheet with roomier rows.
- **Quick light/dark switch.** The menu's first row flips Obsidian's own *Base
  color scheme* (the *Settings → Appearance* setting); its label and icon always
  offer the opposite of the current mode. A vault set to *Adapt to system* is
  switched to an explicit light or dark scheme.

### Changed
- **The two sidebar ribbon icons are now one.** The separate *Open Journal Folder
  sidebar* and *Open Journal Tasks sidebar* ribbon icons have been replaced by the
  single plugin menu above; both sidebars open from that menu (or their commands).

## [2.4.3]

### Added
- **Edit signifiers by clicking the margin in editing view.** The signifier
  gutter is now interactive in live preview: click a line's signifier icons to
  open the same checklist as the *Modify signifiers on the current line…*
  command. On a line with no signifier yet, a faint **+** fades into the margin
  as you hover the line — click it to add one. The cursor turns to a pointer
  over the gutter so it's clear the area is interactive.

## [2.4.2]

### Changed
- **Tasks and Signifiers are no longer marked as preview.** Both features
  graduate out of preview: the "Preview feature" notices on the Tasks and
  Signifiers settings tabs are gone, and the "(preview)" labels and warning
  callouts have been removed from the documentation.

## [2.4.1]

### Changed
- **Sidebar folder picker is now a styled panel.** The journal-folder
  dropdown in the sidebar opens the same `<body>`-portaled panel as the
  **More…** menu instead of a native Obsidian menu — the last native menu
  in the sidebar is gone, so both popups look and behave consistently.
- **Documentation consolidated into the README.** All the user guides now
  live in a single README page, so the links resolve when viewing the plugin
  from Obsidian's community-plugin screen (relative links to separate doc
  files didn't work there). Developer/internals docs remain separate.

### Fixed
- The sidebar folder-picker panel now matches the trigger width on the very
  first open (previously it rendered too narrow until the second open).

## [2.4.0]

### Added
- **Signifiers (preview).** Bind an icon to a tag, bullet-journal style,
  and it shows up in the left margin wherever that tag appears — so you
  can scan a note and find what matters at a glance. Signifiers apply to
  any rendered markdown, not just tasks.
  - Three ship by default: **Priority** (`#important`, ⭐), **Inspiration**
    (`#inspiration`, 💡), and **Explore** (`#explore`, 👁).
  - Render in both reading view and live preview. **Placement in notes**
    is either *Single column — all icons far-left* (the default) or
    *Per entry*; the horizontal position is measured from your actual
    layout, so the markers hold up across themes, CSS snippets, and
    readable-line-width settings.
  - The matched tag is hidden by default (separate toggles for reading
    view and live preview, with an *active line* reveal option), and a
    *Reserve left margin* toggle keeps icons from clipping in narrow panes.
  - Manage them in a dedicated **Signifiers** settings tab, and tag the
    current line from the **Modify signifiers on the current line…**
    command / editor menu.
- **Task migration (preview).** Roll an unfinished task from one note to
  another within the same folder.
  - The origin is stamped with the flow's *migrated* status, a copy is
    written into the destination at a configurable position (*after the
    last task*, *top*, *end*, or *under a heading*), and cross-reference
    links are added in both directions.
  - References are styleable (*text* / *emoji* / *Lucide*, default Lucide),
    each direction can be turned off independently, and they render faded
    (full opacity on hover) to a configurable opacity.
  - Trigger from a per-task editor menu, the *Migrate tasks from / to this
    note…* file-menu pickers, or keyboard commands.
- **Task categories.** Group tasks by tag at the top of every task list
  (sidebar panels and `journal-tasks` blocks), configured under the Tasks
  settings tab.
- **Keyboard commands** for cycling/creating a task on the current line
  and for migrating tasks.

### Changed
- The **Tasks** and **Signifiers** settings tabs now carry a *Preview
  feature* notice, since both are shipped as previews while their models
  settle.

### Fixed
- Live-preview task checkbox clicks now update the status correctly.
- The newer features are mobile-friendly: migration references stay
  legible on touch (no hover to reveal them), the task flow/status
  settings editor reflows to a single column on a phone, and the
  task/scope/menu tap targets are larger. Desktop is unchanged.

### Accessibility
- Live-preview task icons are now decorative rather than announced as
  interactive controls.

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
