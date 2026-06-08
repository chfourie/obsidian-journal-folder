/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export type JournalFolderSettings = {
  dailyNoteTitlePattern: string
  dailyNoteShortTitlePattern: string
  dailyNoteMediumTitlePattern: string
  weeklyNoteTitlePattern: string
  weeklyNoteShortTitlePattern: string
  weeklyNoteMediumTitlePattern: string
  monthlyNoteTitlePattern: string
  monthlyNoteShortTitlePattern: string
  monthlyNoteMediumTitlePattern: string
  quarterlyNoteTitlePattern: string
  quarterlyNoteShortTitlePattern: string
  quarterlyNoteMediumTitlePattern: string
  yearlyNoteTitlePattern: string
  yearlyNoteShortTitlePattern: string
  yearlyNoteMediumTitlePattern: string
  journalFolderTitle: string
  useFolderNameAsDefaultTitle: boolean
  defaultCalendarVisibleDesktop: boolean
  defaultCalendarVisibleMobile: boolean
  // Quarterly notes are off by default — turning them on activates the
  // YYYY-Q[1-4] file pattern and inserts quarters between year and month in
  // the higher/lower-order navigation. Folder-level override goes through
  // the front-matter key `quarters-enabled`.
  quartersEnabled: boolean
  // When enabled, newly created notes whose basename matches a journal file
  // pattern (daily/weekly/monthly/quarterly/yearly) and that live in a folder
  // containing a `journal-folder.md` config note are seeded with a template
  // body. Disable per-folder by setting `auto-template-enabled: false` in
  // that folder's `journal-folder.md` front matter. The template body itself
  // can be overridden globally via `autoTemplateContent` and per-folder by
  // putting markdown in the body of `journal-folder.md`.
  autoTemplateEnabled: boolean
  // Vault path of the folder holding the **template notes** that seed new
  // journal entries. Inside it the plugin looks up standardized filenames by
  // tier — `daily.md` / `weekly.md` / `monthly.md` / `quarterly.md` /
  // `yearly.md`, with `default.md` as the cross-tier fallback. A template
  // note's body (front matter included) is copied verbatim into the new
  // note. Defaults to `Templates/journal-folder` — plugin-namespaced so it
  // won't clash with a user's own `Templates/` folder or another template
  // plugin. **Global only.**
  templateFolder: string
  // Name of a subfolder, *relative to each journal folder*, that overrides
  // the global template notes for that folder only (same standardized
  // filenames). Drop a `monthly.md` in `<journalFolder>/Templates/` and it
  // beats the global `monthly.md`. Default `Templates`. **Global only** —
  // the name is process-wide; the override itself is expressed by the files
  // present in each folder, so it needs no per-folder setting.
  templateOverrideFolderName: string
  // Bookkeeping flag: set once the one-time migration of legacy inline
  // template text (the `*AutoTemplateContent` fields below) into template
  // notes under `templateFolder` has run, so it never repeats. **Global
  // only.**
  templatesMigratedToFiles: boolean
  // @deprecated Legacy inline template text. No longer read once migrated
  // into template notes (see `templateFolder`); left in the type so the
  // one-time migration can still consume it and so existing `data.json`
  // values are preserved as a backup.
  autoTemplateContent: string
  // @deprecated Legacy per-tier toggle. See `templateFolder` — per-tier
  // templates are now separate notes (`daily.md`, …). Kept for migration.
  autoTemplatePerTier: boolean
  // @deprecated Legacy per-tier inline template text. Migrated into
  // `daily.md` / `weekly.md` / … under `templateFolder`. Kept for migration.
  dailyNoteAutoTemplateContent: string
  weeklyNoteAutoTemplateContent: string
  monthlyNoteAutoTemplateContent: string
  quarterlyNoteAutoTemplateContent: string
  yearlyNoteAutoTemplateContent: string
  // Controls the first day of the week. `'locale-default'` leaves moment's
  // current locale untouched; the explicit weekday names override moment's
  // locale so both the calendar grid and `gggg-[W]ww` week numbering shift
  // accordingly. Applied globally — this overrides moment's locale for the
  // running Obsidian process, so folder-level overrides are intentionally
  // not honoured for this field.
  startOfWeek: StartOfWeekSetting
  // Folder path of the user's preferred journal folder. The sidebar opens
  // here on first load; the *Switch to default folder* action resets the
  // sidebar context to this value. Empty string means "no default chosen
  // yet" — the sidebar then falls back to the first detected journal
  // folder. **Global only** — this is a UI preference, not a per-folder
  // concept.
  defaultJournalFolder: string
  // When true, every `journal-folder.md` file is hidden from Obsidian's
  // built-in file explorer via a body-class-scoped CSS rule. The notes
  // still exist on disk and remain accessible via search, links, and the
  // sidebar's *Edit configuration* action — they just don't clutter the
  // tree. **Global only** because the file-explorer DOM is process-wide.
  hideJournalFolderNotes: boolean
  // Controls how the sidebar follows (or doesn't follow) the active leaf.
  // `'dynamic'` switches the sidebar's selected folder whenever the active
  // file is a recognised journal note in a journal folder, and scrolls the
  // calendar to that note's period. `'static'` ignores active-leaf changes
  // — the sidebar only moves when the user picks a folder explicitly.
  // **Global only** because the sidebar is a singleton view.
  sidebarMode: SidebarMode
  // Master toggle for the sidebar's task panel. Off by default so the
  // sidebar stays minimal for users who don't journal with tasks.
  // **Global only** — the sidebar is a singleton view.
  tasksSidebarEnabled: boolean
  // The reference *anchor* the sidebar task panel uses — the point the
  // range is measured from. `'today'` anchors on the current date;
  // `'note'` anchors on the active journal note's date (falls back to
  // today when the active leaf is not a journal note). Persisted from
  // the sidebar's scope panel. **Global only** — the panel *is* the
  // control.
  tasksSidebarAnchor: TasksSidebarAnchor
  // The reference *range* (window size) around the anchor. `'day'` /
  // `'week'` / `'month'` / `'quarter'` / `'year'` list tasks whose
  // source-note period intersects the calendar period of that size
  // containing the anchor; `'all'` applies no date filtering (every
  // task in the folder scope). `'quarter'` is only offered in the
  // picker when `quartersEnabled`. **Global only.**
  tasksSidebarRange: TasksSidebarRange
  // How the sidebar task panel chooses which folder(s) to scan.
  // `'note'` = the active note's folder; `'all'` = every known journal
  // folder; `'specific'` = the single folder in `tasksSidebarFolder`.
  // Independent of the anchor. **Global only** — scope is a UI
  // preference for the singleton view.
  tasksSidebarFolderMode: TasksSidebarFolderMode
  // The folder scanned when `tasksSidebarFolderMode` is `'specific'`.
  // Empty string falls back to "every known journal folder".
  // **Global only.**
  tasksSidebarFolder: string
  // View-side filter — when false, tasks satisfying `model.isDone` are
  // hidden and the panel header surfaces the hidden count. Persisted
  // from the sidebar's inline link toggle. **Global only** — the
  // in-note `journal-tasks` block has its own view-local toggle that
  // does not persist.
  tasksShowCompleted: boolean
  // Independent reference / folder-scope / completed-filter state for
  // the **tasks-only sidebar view** (the standalone tasks ribbon icon).
  // Kept separate from the combined sidebar's `tasksSidebar*` fields so
  // toggling one panel doesn't reach across and change the other.
  // **Global only** — same singleton reasoning as the combined sidebar.
  tasksOnlySidebarAnchor: TasksSidebarAnchor
  tasksOnlySidebarRange: TasksSidebarRange
  tasksOnlySidebarFolderMode: TasksSidebarFolderMode
  tasksOnlySidebarFolder: string
  tasksOnlySidebarShowCompleted: boolean
  // Hard cap on the number of tasks rendered (sidebar + in-note). When
  // exceeded, a footer shows "Showing N of M — increase limit in
  // settings". **Global only** — protects render perf in long-range
  // notes; per-folder overrides aren't useful here.
  tasksMaxItems: number
  // User-defined task flows. Keyed by display name; each value bundles
  // the full status array (label, char, isDone, next, shell, icon,
  // colour) with the flow's single rendering mode (plugin vs theme).
  // Rendering is *flow-level* because mixing plugin and theme
  // rendering inside the same nested list paints unreliably across
  // themes. Built-in templates (Simple, Kanban, Bullet Journal, GTD)
  // are *not* stored here — they live in code and are applied into a
  // flow to seed it. **Global only** — the flow dictionary is the
  // source of truth that folder-level overrides reference by name.
  taskFlows: Record<string, TaskFlow>
  // Name of the flow used when no per-folder override is set, or when
  // a folder's override points at a flow that no longer exists.
  // Must be a key in `taskFlows`. **Global only.**
  defaultTaskFlow: string
  // Per-folder override: name of the task flow this folder uses.
  // Empty string (the global default) means "use defaultTaskFlow".
  // Resolved via the folder's `journal-folder.md` front matter under
  // the kebab-cased key `task-flow`. **Folder-honored** — this is
  // the *only* task-related field a folder may override; changes to
  // the flow itself are still made globally.
  taskFlow: string
  // Scope of the plugin's task interactions (left-click cycle,
  // right-click status menu, custom status icon):
  //   `'lists'`       — interactions are wired in the plugin's own
  //                     task lists only (the sidebar panel, the
  //                     tasks-only sidebar, the in-note `journal-
  //                     tasks` block). Document-body checkboxes are
  //                     left to Obsidian.
  //   `'everywhere'`  — additionally intercept every task checkbox
  //                     in the rendered document (reading view +
  //                     live preview).
  // **Default:** `'lists'` — keeps document-body checkboxes on
  // Obsidian's native behaviour so the plugin doesn't silently
  // change existing vaults on upgrade.
  // **Global only** — interception happens at process-wide layers
  // (markdown post-processor, editor extension, settings tab).
  taskInteractionScope: TaskInteractionScope
  // Where the task-migration commands insert the copied task lines in
  // the destination note:
  //   `'heading'`         — under the heading named by
  //                         `taskMigrationHeading` (created if absent).
  //   `'after-last-task'` — after the note's last existing task line
  //                         (falls back to end-of-note when none).
  //   `'top'`             — after front matter, before the body.
  //   `'end'`             — appended to the bottom of the note.
  // **Folder-honored** — unlike the other `task*` fields (which are
  // process-wide model / UI preferences), placement is a per-note
  // *layout* concern, so a folder may override it via the front-matter
  // key `task-migration-placement`.
  taskMigrationPlacement: TaskMigrationPlacement
  // Heading text used when `taskMigrationPlacement` is `'heading'`.
  // Matched case-insensitively against existing `#`-level headings;
  // created as a level-2 heading at the end of the note when missing.
  // **Folder-honored** via `task-migration-heading`.
  taskMigrationHeading: string
  // Whether migration writes the forward reference (`toMarker [[dest]]`)
  // onto the **origin** task. When false, the origin is only re-stamped
  // with the migrated status — no link is added. **Global only.**
  taskMigrationAddToReference: boolean
  // Whether migration writes the back reference (`fromMarker [[origin]]`)
  // onto the **copied** task. When false, the copy is a plain task with
  // no link back to its source. **Global only.**
  taskMigrationAddFromReference: boolean
  // Representation style for the migration cross-reference markers — the
  // small indicator placed before each `[[link]]`. Selecting a style in
  // the settings tab reseeds both markers below with that style's
  // defaults; the markers stay individually editable afterwards.
  // **Global only.**
  taskMigrationReferenceStyle: TaskMigrationReferenceStyle
  // Marker prefixed to the forward link written on the **origin** task
  // ("migrated to" → destination). Empty = link only, no marker.
  // **Global only.**
  taskMigrationToMarker: string
  // Marker prefixed to the back link written on the **copied** task
  // ("migrated from" → origin). Empty = link only, no marker.
  // **Global only.**
  taskMigrationFromMarker: string
  // Opacity (0–100) applied to the *whole* migration reference (marker +
  // link) in reading view; the reference fades up to 100% on hover. Lets
  // the cross-reference recede visually until the user looks for it.
  // **Global only** — applied by the reading-view post-processor.
  taskMigrationReferenceOpacity: number
  // Signifiers bind an icon to one or more tags (BUJO-style). The
  // standard signifiers (priority / inspiration / explore) ship by
  // default. **Global only** — never overridable per task-flow or per
  // folder; the dictionary is the single source of truth for tag→icon
  // rendering everywhere.
  signifiers: Signifier[]
  // Whether reading view *hides* the matched tag and shows only the
  // signifier icon (true) or shows both the icon and the tag (false).
  // The plugin's own task lists ALWAYS hide the tag regardless. **Global
  // only** — applied by the reading-view post-processor.
  signifierHideTagInReadingView: boolean
  // Whether live preview hides the matched tag text (showing only the
  // signifier icon) the way reading view does. On by default. The tag is
  // revealed while the cursor / selection touches it so it stays editable.
  // **Global only** — drives the live-preview CodeMirror extension.
  signifierHideTagInLivePreview: boolean
  // When hiding tags in live preview, whether placing the cursor on a line
  // reveals ALL of that line's signifier tags (true) or only the single tag
  // the cursor actually touches (false). Off by default. No effect when
  // `signifierHideTagInLivePreview` is off. **Global only.**
  signifierShowTagsOnActiveLine: boolean
  // Where signifier icons sit in notes (reading view + live preview). Both
  // values are left-margin gutters positioned by measurement (so they hold
  // up across themes / snippets / indentation):
  //   `'margin'`        — hangs just left of each entry, indented with its
  //                       nesting (a per-entry gutter).
  //   `'margin-column'` — every icon aligned in ONE far-left column,
  //                       regardless of nesting depth. **Default.**
  // The optional `signifierReserveGutter` keeps them from clipping in narrow /
  // readable-off views. **Global only.** Does not affect the plugin's own
  // task lists, which always render signifiers inline.
  signifierPlacement: SignifierPlacement
  // For the margin (gutter) placements only: reserve a left lane (pad the
  // note content right just enough) so signifiers never clip when readable
  // line width is off or the view is narrowed. On by default; recomputed on
  // any sizer-width change. No effect on the flow placements. **Global only.**
  signifierReserveGutter: boolean
  // Task categories group tasks by tag at the top of every task list.
  // An ordered list — the editor order is the section order. An
  // "Important" category (bound to `#important`, the priority
  // signifier's tag) ships by default. **Global only.**
  taskCategories: TaskCategory[]
  // Single global toggle: when true, a categorized task ALSO appears in
  // its note's group below the category sections; when false it appears
  // only under its category. Uncategorized tasks always appear under
  // their note. **Global only.**
  taskCategoryShowUnderNote: boolean
}

export type TaskInteractionScope = 'lists' | 'everywhere'

export type TaskMigrationPlacement =
  | 'heading'
  | 'after-last-task'
  | 'top'
  | 'end'

export type TaskMigrationReferenceStyle = 'text' | 'emoji' | 'lucide'

// Default markers per reference style. Picking a style in the settings
// tab reseeds the To / From markers from here. Exported so the settings
// UI and any tests share one source of truth. Lucide markers are stored
// as `lucide:<name>` tokens — written verbatim into the note and
// rendered as icons by the reading-view post-processor.
export const MIGRATION_REFERENCE_PRESETS: Record<
  TaskMigrationReferenceStyle,
  { to: string; from: string }
> = {
  text: { to: '→', from: '←' },
  emoji: { to: '➡️', from: '⬅️' },
  lucide: { to: 'lucide:redo-dot', from: 'lucide:undo-dot' },
}

// Prefix marking a Lucide-icon reference marker. The text after it is a
// Lucide icon name; the reading-view post-processor renders it as an
// icon, while editing/source view shows the readable token.
export const LUCIDE_MARKER_PREFIX = 'lucide:'

import type { TaskFlow } from './task-model.type'
import type { Signifier, TaskCategory } from './signifier.type'
import {
  BUILTIN_TEMPLATES,
  cloneTemplate,
  DEFAULT_TEMPLATE_ID,
} from './task-templates'

export type TasksSidebarAnchor = 'today' | 'note'

export type TasksSidebarRange =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all'

export type TasksSidebarFolderMode = 'note' | 'all' | 'specific'

export type SignifierPlacement = 'margin' | 'margin-column'

export type SidebarMode = 'static' | 'dynamic'

export type StartOfWeekSetting =
  | 'locale-default'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export const DEFAULT_SETTINGS: JournalFolderSettings = {
  dailyNoteTitlePattern: 'dddd, DD MMMM YYYY',
  dailyNoteShortTitlePattern: 'ddd, D MMM',
  dailyNoteMediumTitlePattern: 'ddd, D MMM YY',
  weeklyNoteTitlePattern: 'gggg [Week] w',
  weeklyNoteShortTitlePattern: '[W]ww',
  weeklyNoteMediumTitlePattern: '[W]ww gg',
  monthlyNoteTitlePattern: 'MMMM YYYY',
  monthlyNoteShortTitlePattern: 'MMM',
  monthlyNoteMediumTitlePattern: 'MMM YY',
  quarterlyNoteTitlePattern: 'YYYY [Quarter] Q',
  quarterlyNoteShortTitlePattern: '[Q]Q',
  quarterlyNoteMediumTitlePattern: '[Q]Q YY',
  yearlyNoteTitlePattern: 'YYYY',
  yearlyNoteShortTitlePattern: 'YYYY',
  yearlyNoteMediumTitlePattern: 'YYYY',
  journalFolderTitle: '',
  useFolderNameAsDefaultTitle: false,
  defaultCalendarVisibleDesktop: true,
  defaultCalendarVisibleMobile: false,
  quartersEnabled: false,
  autoTemplateEnabled: false,
  templateFolder: 'Templates/journal-folder',
  templateOverrideFolderName: 'Templates',
  templatesMigratedToFiles: false,
  autoTemplateContent: '',
  autoTemplatePerTier: false,
  dailyNoteAutoTemplateContent: '',
  weeklyNoteAutoTemplateContent: '',
  monthlyNoteAutoTemplateContent: '',
  quarterlyNoteAutoTemplateContent: '',
  yearlyNoteAutoTemplateContent: '',
  startOfWeek: 'locale-default',
  defaultJournalFolder: '',
  hideJournalFolderNotes: true,
  sidebarMode: 'dynamic',
  tasksSidebarEnabled: false,
  tasksSidebarAnchor: 'note',
  tasksSidebarRange: 'day',
  tasksSidebarFolderMode: 'all',
  tasksSidebarFolder: '',
  tasksShowCompleted: true,
  tasksOnlySidebarAnchor: 'note',
  tasksOnlySidebarRange: 'day',
  tasksOnlySidebarFolderMode: 'all',
  tasksOnlySidebarFolder: '',
  tasksOnlySidebarShowCompleted: true,
  tasksMaxItems: 200,
  taskFlows: {
    Default: {
      statuses: cloneTemplate(BUILTIN_TEMPLATES[DEFAULT_TEMPLATE_ID]),
      rendering: 'plugin',
    },
  },
  defaultTaskFlow: 'Default',
  taskFlow: '',
  taskInteractionScope: 'lists',
  taskMigrationPlacement: 'after-last-task',
  taskMigrationHeading: 'Tasks',
  taskMigrationAddToReference: true,
  taskMigrationAddFromReference: true,
  taskMigrationReferenceStyle: 'lucide',
  taskMigrationToMarker: MIGRATION_REFERENCE_PRESETS.lucide.to,
  taskMigrationFromMarker: MIGRATION_REFERENCE_PRESETS.lucide.from,
  taskMigrationReferenceOpacity: 30,
  // Standard Bullet-Journal signifiers. Priority shares the `important`
  // tag with the default Important category below.
  signifiers: [
    {
      id: 'priority',
      label: 'Priority',
      tags: ['important'],
      icon: {
        source: { kind: 'lucide', name: 'star' },
        color: { kind: 'token', var: '--color-yellow' },
      },
    },
    {
      id: 'inspiration',
      label: 'Inspiration',
      tags: ['inspiration'],
      icon: {
        source: { kind: 'lucide', name: 'lightbulb' },
        color: { kind: 'token', var: '--color-yellow' },
      },
    },
    {
      id: 'explore',
      label: 'Explore',
      tags: ['explore'],
      icon: {
        source: { kind: 'lucide', name: 'eye' },
        color: { kind: 'token', var: '--color-blue' },
      },
    },
  ],
  signifierHideTagInReadingView: true,
  signifierHideTagInLivePreview: true,
  signifierShowTagsOnActiveLine: false,
  signifierPlacement: 'margin-column',
  signifierReserveGutter: true,
  taskCategories: [
    {
      id: 'important',
      label: 'Important',
      tags: ['important'],
      icon: {
        source: { kind: 'lucide', name: 'star' },
        color: { kind: 'token', var: '--color-yellow' },
      },
    },
  ],
  taskCategoryShowUnderNote: false,
}
