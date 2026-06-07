# Journal Folder — Release Verification Report

> Generated automatically by the end-to-end test suite while preparing a release. Every scenario below was executed against a **live Obsidian instance**, and the screenshots were captured from that same run. It is both the evidence of what was verified and a guided tour of the plugin in action.

| | |
| --- | --- |
| **Plugin version** | 3.1.2 |
| **Obsidian** | unknown |
| **Generated** | 2026-06-07 |
| **Suites** | 16 |
| **Result** | ✅ 78 passed |
| **Screenshots** | 71 |

## Contents

- [smoke](#smoke)
- [header-nav](#header-nav)
- [calendar](#calendar)
- [tasks-render](#tasks-render)
- [task-status](#task-status)
- [task-migration](#task-migration)
- [tasks-scope](#tasks-scope)
- [signifiers](#signifiers)
- [auto-template](#auto-template)
- [template-preview](#template-preview)
- [template-repopulate](#template-repopulate)
- [settings](#settings)
- [settings-config](#settings-config)
- [sidebar](#sidebar)
- [folder-config](#folder-config)
- [ribbon-theme](#ribbon-theme)

---

## smoke

Baseline checks that the plugin loads and that a journal note renders its header while a non-journal note stays untouched.

### ✓ plugin is loaded and exposes settings _(689ms)_

1. Confirm the Journal Folder plugin is installed and active.

### ✓ daily note renders the journal header _(3048ms)_

1. Open a daily note and check the journal header appears.

![Daily note journal header](assets/smoke/01-daily-note-journal-header.png)

*Daily note journal header*

### ✓ header is a no-op in a non-journal note _(1767ms)_

1. Open an ordinary note and confirm no journal header is added.

---

## header-nav

The in-note journal header rendered by the `journal-header` code block — the folder title, the entry’s H1, the back / Today / forward navigation row, and the “More…” popover that hosts the calendar toggle and secondary links.

### ✓ daily note renders the folder title and H1 title _(2892ms)_

1. Open the daily note Journal/2026-06-06 in reading view.
2. Header shows the folder title “Journal” and the entry’s H1.

![Daily note header](assets/header-nav/01-daily-note-header.png)

*Daily note header*

### ✓ backward navigation link targets the previous day _(2764ms)_

1. The ‹‹ back link on 2026-06-06 resolves to the previous day, 2026-06-05.

![Navigation row (back / Today / forward)](assets/header-nav/02-navigation-row-back-today-forward.png)

*Navigation row (back / Today / forward)*

### ✓ More popover opens and shows a calendar toggle _(3234ms)_

1. Click “More…” to open the secondary popover (portaled to <body>).

![“More…” popover with the calendar toggle](assets/header-nav/03-more-popover-with-the-calendar-toggle.png)

*“More…” popover with the calendar toggle*

### ✓ monthly note renders a header too _(2825ms)_

1. Open the monthly note Journal/2026-06 — the header adapts to the month tier.

![Monthly note header](assets/header-nav/04-monthly-note-header.png)

*Monthly note header*

### ✓ a past note links forward to the next day _(2799ms)_

1. On the past note 2026-06-05 the ›› forward link points at the next day.

![Forward navigation on a past note](assets/header-nav/05-forward-navigation-on-a-past-note.png)

*Forward navigation on a past note*

---

## calendar

The in-note calendar shows the current month as a grid of day cells, marks which days already have notes, lets you jump around with arrows and a Year/Month picker, and creates a missing entry when you click an empty day.

### ✓ calendar renders day cells and a weekday header _(2831ms)_

1. Open the daily note Journal/2026-06-06 in reading view.
2. The calendar shows the month grid with 92 day cells.

![Month calendar](assets/calendar/01-month-calendar.png)

*Month calendar*

### ✓ an existing day cell is marked exists; a missing one is marked missing _(2756ms)_

1. Open the daily note Journal/2026-06-06 in reading view.
2. Days with a note are styled as existing; empty days are styled as missing.

![Existing vs missing day cells](assets/calendar/02-existing-vs-missing-day-cells.png)

*Existing vs missing day cells*

### ✓ Year/Month picker opens with a month grid _(3114ms)_

1. Open the daily note and click the Year/Month picker trigger.
2. The picker opens with a year selector and twelve month options.

![Year/Month picker](assets/calendar/03-year-month-picker.png)

*Year/Month picker*

### ✓ clicking a past empty day cell creates the note after confirmation _(4100ms)_

1. Click the past, empty day cell for 2026-06-04.
2. A confirmation modal asks before creating the missing note.
3. Confirming creates the note Journal/2026-06-04 on disk.

![Create-missing-note confirmation](assets/calendar/04-create-missing-note-confirmation.png)

*Create-missing-note confirmation*

### ✓ prev / next arrows change the visible months _(4334ms)_

1. Open the daily note, then click the next arrow to advance a month.
2. The next arrow scrolls July into view.
3. Two clicks of the prev arrow scroll back to May.

![Next month in view](assets/calendar/05-next-month-in-view.png)

*Next month in view*

### ✓ the Current link jumps back to today’s month _(4245ms)_

1. Open the daily note and scroll two months ahead so the Current link appears.
2. Clicking Current jumps the calendar back to today’s month.

![Back to current month](assets/calendar/06-back-to-current-month.png)

*Back to current month*

### ✓ quarter cell appears only when quarters are enabled _(4214ms)_

1. With quarters off (baseline), the calendar shows no quarter cell.
2. Enabling quarters adds a quarter cell to the calendar.

![Calendar with quarters enabled](assets/calendar/07-calendar-with-quarters-enabled.png)

*Calendar with quarters enabled*

---

## tasks-render

Tasks appear in two places: an in-note journal-tasks block that aggregates tasks for the note’s period, and a sidebar task panel. Both render custom status icons, group tasks by source note and category, and show a truncation footer when the item limit is reached.

### ✓ in-note journal-tasks block renders task rows _(2823ms)_

1. Open the daily note Journal/2026-06-06 in reading view.
2. The in-note journal-tasks block lists 7 task rows.

![In-note task block](assets/tasks-render/01-in-note-task-block.png)

*In-note task block*

### ✓ plugin-rendered status icons are present (Bullet Journal flow) _(2768ms)_

1. Open the daily note in reading view.
2. Each task row shows a custom Bullet Journal status icon.

![Bullet Journal status icons](assets/tasks-render/02-bullet-journal-status-icons.png)

*Bullet Journal status icons*

### ✓ document-body checkboxes get the plugin swap marker _(3058ms)_

1. Open the daily note and inspect the raw task lines in the note body.
2. Native checkboxes in the note body are swapped for the plugin’s status icons.

![Document body status icons](assets/tasks-render/03-document-body-status-icons.png)

*Document body status icons*

### ✓ sidebar task panel renders with a scope trigger _(3874ms)_

1. Open the daily note and reveal the sidebar task panel.
2. The sidebar panel lists tasks with a Scope opener for narrowing the view.

![Sidebar task panel](assets/tasks-render/04-sidebar-task-panel.png)

*Sidebar task panel*

### ✓ tasks are grouped under their source note _(3760ms)_

1. Open the daily note and reveal the sidebar task panel.
2. Tasks in the sidebar are grouped under the note they came from.

![Tasks grouped by source note](assets/tasks-render/05-tasks-grouped-by-source-note.png)

*Tasks grouped by source note*

### ✓ tasks matching a category appear in a category section _(4235ms)_

1. Anchor the panel on the active note and open the sidebar task panel.
2. A task tagged #important surfaces under its Important category section.

![Important category section](assets/tasks-render/06-important-category-section.png)

*Important category section*

### ✓ the truncation footer appears when the item cap is hit _(4237ms)_

1. Set the item limit to 1 and open the sidebar task panel on the note.
2. When the cap is exceeded, a truncation footer offers to raise the limit.

![Truncation footer](assets/tasks-render/07-truncation-footer.png)

*Truncation footer*

---

## task-status

Clicking a task’s status icon cycles it through the active flow (open → in-progress → done) and writes the change straight back to the note on disk; right-clicking opens an in-house status picker for jumping to any status, including cancelled. The same works from the sidebar panel.

### ✓ left-click cycles open → in-progress and writes to disk _(3716ms)_

1. Open the daily note Journal/2026-06-06 with its open task on line 11.
2. Left-clicking the icon cycles the task to in-progress and saves it to disk.

![Task cycled to in-progress](assets/task-status/01-task-cycled-to-in-progress.png)

*Task cycled to in-progress*

### ✓ right-click opens the status picker _(3296ms)_

1. Open the daily note and right-click the open task’s status icon.
2. The status picker opens listing every status in the flow.

![Status picker](assets/task-status/02-status-picker.png)

*Status picker*

### ✓ choosing a status from the picker persists it _(3831ms)_

1. Open the daily note and right-click the task to open the status picker.
2. Choose Cancelled from the picker.
3. The cancelled status is written back to the note on disk.

![Choosing Cancelled](assets/task-status/03-choosing-cancelled.png)

*Choosing Cancelled*

### ✓ cycling from the sidebar panel also writes to disk _(5011ms)_

1. Anchor on the active note and open the sidebar task panel.
2. Click the open task’s status icon in the sidebar.
3. Cycling from the sidebar advances the status and saves it to disk.

![Cycling a task from the sidebar](assets/task-status/04-cycling-a-task-from-the-sidebar.png)

*Cycling a task from the sidebar*

### ✓ theme-rendering flow keeps the native checkbox (no plugin icon swap) _(3555ms)_

1. Switch the active flow to theme rendering and reopen the daily note.
2. Under theme rendering the note keeps Obsidian’s native checkboxes, with no plugin icon swap.

![Native checkboxes under theme rendering](assets/task-status/05-native-checkboxes-under-theme-rendering.png)

*Native checkboxes under theme rendering*

---

## task-migration

Task migration moves unfinished tasks forward between journal notes in the same folder. You pick tasks from sibling notes in a picker; the origin is marked as migrated and linked to its new home, and a fresh copy lands in the destination note with a link back.

### ✓ the migrate picker lists active tasks from sibling notes _(3995ms)_

1. From a destination note, run "Migrate tasks to this note" to open the picker, which groups the still-open tasks from sibling notes ready to pull forward.

![Migration picker grouping open tasks by note](assets/task-migration/01-migration-picker-grouping-open-tasks-by-note.png)

*Migration picker grouping open tasks by note*

### ✓ migrating stamps the origin and copies the task to the destination _(7229ms)_

1. Tick the task you want and confirm; the origin is stamped as migrated and a copy is written into the note you ran the command from.

![Task selected, ready to migrate](assets/task-migration/02-task-selected-ready-to-migrate.png)

*Task selected, ready to migrate*

![Destination note with the migrated task copied in](assets/task-migration/03-destination-note-with-the-migrated-task-copied-in.png)

*Destination note with the migrated task copied in*

### ✓ cancelling the picker changes nothing _(3316ms)_

1. Cancelling the picker leaves every note exactly as it was, so opening it to browse never changes anything.

---

## tasks-scope

The sidebar task panel gathers tasks from your journal and lets you narrow what it shows along four axes — anchor, time range, folders, and a completed filter. Your choices are remembered, and the quarter range only appears when quarterly notes are enabled.

### ✓ scope summary reflects the baseline scope _(3860ms)_

1. Open the sidebar task panel; a one-line summary at the top tells you the current scope at a glance.

![Task panel with its scope summary](assets/tasks-scope/01-task-panel-with-its-scope-summary.png)

*Task panel with its scope summary*

### ✓ scope panel opens with all four axes _(4444ms)_

1. Click Scope to open the panel, which exposes all four axes: anchor, time range, folders, and the completed filter.

![Scope panel showing all four axes](assets/tasks-scope/02-scope-panel-showing-all-four-axes.png)

*Scope panel showing all four axes*

### ✓ changing the range persists to settings _(4691ms)_

1. Pick a wider time range, such as Week, and the panel remembers it across sessions.

![Week range selected in the scope panel](assets/tasks-scope/03-week-range-selected-in-the-scope-panel.png)

*Week range selected in the scope panel*

### ✓ changing the anchor persists to settings _(4667ms)_

1. Switch the anchor to the current note so the task list follows whichever journal note you are viewing, and that choice is saved.

![Current-note anchor selected](assets/tasks-scope/04-current-note-anchor-selected.png)

*Current-note anchor selected*

### ✓ selecting all-folders persists to settings _(4696ms)_

1. Choose All journal folders to pull tasks from every journal at once, and the panel keeps that setting.

![All-folders scope selected](assets/tasks-scope/05-all-folders-scope-selected.png)

*All-folders scope selected*

### ✓ toggling show-completed persists to settings _(4745ms)_

1. Toggle the completed filter to show or hide finished tasks; the preference is remembered for next time.

![Completed-tasks filter toggled](assets/tasks-scope/06-completed-tasks-filter-toggled.png)

*Completed-tasks filter toggled*

### ✓ the quarter range option is gated by quartersEnabled _(7233ms)_

1. The Quarter range only shows up once quarterly notes are enabled; with quarters off it is absent, and after turning them on it appears among the range options.

![Quarter range option available with quarters enabled](assets/tasks-scope/07-quarter-range-option-available-with-quarters-enabled.png)

*Quarter range option available with quarters enabled*

---

## signifiers

Signifiers turn tags into small icons drawn in a left-margin gutter beside your journal entries, hiding the underlying tag text. You can line every icon up in one far-left column or hang each icon next to its own entry, in both reading view and live preview.

### ✓ reading view renders signifier icons in a gutter _(3095ms)_

1. Open a daily note in reading view; tagged lines show their signifier icons in the left-margin gutter instead of the raw tags.

![Signifier icons in the reading-view gutter](assets/signifiers/01-signifier-icons-in-the-reading-view-gutter.png)

*Signifier icons in the reading-view gutter*

### ✓ matched tag text is hidden in reading view _(3051ms)_

1. With the icon shown in the gutter, the original tag text is hidden in reading view so the entry reads cleanly.

![Matched tag hidden in reading view](assets/signifiers/02-matched-tag-hidden-in-reading-view.png)

*Matched tag hidden in reading view*

### ✓ margin-column placement adds the column modifier _(3059ms)_

1. Under the default margin-column placement, every icon lines up in one far-left column like the rule down a physical journal page.

![Icons aligned in a single far-left column](assets/signifiers/03-icons-aligned-in-a-single-far-left-column.png)

*Icons aligned in a single far-left column*

### ✓ switching to per-row margin drops the column modifier _(3461ms)_

1. Switching to per-row margin placement hangs each icon just left of its own entry, indented to follow the line it belongs to.

![Icons hung next to each entry (per-row margin)](assets/signifiers/04-icons-hung-next-to-each-entry-per-row-margin.png)

*Icons hung next to each entry (per-row margin)*

### ✓ live preview renders a gutter marker _(3081ms)_

1. Signifiers also render while editing: live preview shows the same gutter icons as you type.

![Signifier gutter in live preview](assets/signifiers/05-signifier-gutter-in-live-preview.png)

*Signifier gutter in live preview*

### ✓ live preview reveals the tag on the active line, hides it elsewhere _(4100ms)_

1. When you place the cursor on a line, its tag is revealed for editing while signifier tags on other lines stay hidden behind their icons.

![Active line reveals its tag, others stay hidden](assets/signifiers/06-active-line-reveals-its-tag-others-stay-hidden.png)

*Active line reveals its tag, others stay hidden*

---

## auto-template

When auto-templating is on, a newly created journal note is pre-filled from the matching template note (with per-folder overrides and a default fallback); notes outside a journal folder and notes created with the feature off stay empty.

### ✓ a new journal note is seeded from the matching tier template file _(2313ms)_

1. Create a new daily note and confirm it is pre-filled from the daily template.

### ✓ a tier with no dedicated file falls back to default-template.md _(2330ms)_

1. Create a weekly note with no weekly template and confirm it falls back to the default template.

### ✓ a per-folder override file beats the global template file _(2854ms)_

1. Create a monthly note and confirm the per-folder override template wins over the global one.

### ✓ a template file keeps its front matter verbatim _(2328ms)_

1. Create a note from a template that has front matter and confirm the front matter is copied verbatim.

### ✓ a non-journal note is not seeded _(2224ms)_

1. Create a note outside any journal folder and confirm it is left empty.

### ✓ with auto-template disabled the note stays empty _(2627ms)_

1. Turn auto-templating off, create a daily note, and confirm it stays empty.

---

## template-preview

A standardized template note previews as the current-period entry: it shows a corner TEMPLATE ribbon and its header chips and calendar cells are display-only, pointing back at the template file rather than at real journal notes.

### ✓ a template note renders the header with a TEMPLATE ribbon _(3510ms)_

1. Open the monthly template note and confirm it previews as a live entry with a TEMPLATE ribbon.

![Template note preview with TEMPLATE ribbon](assets/template-preview/01-template-note-preview-with-template-ribbon.png)

*Template note preview with TEMPLATE ribbon*

### ✓ navigation chips are display-only — they link to the template itself _(2334ms)_

1. Confirm the header navigation chips link to the template file instead of real month notes.

### ✓ calendar cells are display-only but still report their real date _(3437ms)_

1. Confirm the preview calendar cells are display-only but still carry their real dates.

![Template preview calendar](assets/template-preview/02-template-preview-calendar.png)

*Template preview calendar*

### ✓ a real journal note has no TEMPLATE ribbon _(3383ms)_

1. Open a real journal note and confirm it has no TEMPLATE ribbon.

![Real journal note header (no ribbon)](assets/template-preview/03-real-journal-note-header-no-ribbon.png)

*Real journal note header (no ribbon)*

---

## template-repopulate

The sidebar More... menu offers "Re-populate note from template", a destructive action that overwrites the active journal note with its resolved template after a confirmation. The item only shows for journal notes with templating enabled, and cancelling leaves the note untouched.

### ✓ the item appears for a journal note and overwrites it after confirm _(6692ms)_

1. Open the sidebar More... menu over a journal note and find the re-populate action.
2. Confirm the destructive overwrite and verify the note is replaced with the template.

![Sidebar More... menu with re-populate action](assets/template-repopulate/01-sidebar-more-menu-with-re-populate-action.png)

*Sidebar More... menu with re-populate action*

![Re-populate confirmation modal](assets/template-repopulate/02-re-populate-confirmation-modal.png)

*Re-populate confirmation modal*

### ✓ cancelling the confirmation leaves the note unchanged _(5830ms)_

1. Open the re-populate confirmation and cancel it, expecting the note to be left alone.

![Re-populate confirmation before cancelling](assets/template-repopulate/03-re-populate-confirmation-before-cancelling.png)

*Re-populate confirmation before cancelling*

### ✓ the item is absent for a non-journal note _(4861ms)_

1. Open the More... menu over a non-journal note and confirm the re-populate action is absent.

![More... menu on a non-journal note (no re-populate)](assets/template-repopulate/04-more-menu-on-a-non-journal-note-no-re-populate.png)

*More... menu on a non-journal note (no re-populate)*

### ✓ the item is absent when templating is disabled _(5229ms)_

1. Disable auto-templating, open the More... menu, and confirm the re-populate action is hidden.

![More... menu with templating disabled (no re-populate)](assets/template-repopulate/05-more-menu-with-templating-disabled-no-re-populate.png)

*More... menu with templating disabled (no re-populate)*

---

## settings

The plugin settings dialog, where you tune journalling behaviour. Its tabbed layout groups related options, and clicking a tab swaps to the matching panel.

### ✓ settings tab renders the tab strip _(2488ms)_

1. Open the Journal Folder settings dialog to reveal its tab strip.

![Settings dialog tab strip](assets/settings/01-settings-dialog-tab-strip.png)

*Settings dialog tab strip*

### ✓ the expected tabs exist _(2539ms)_

1. Confirm the General, Tasks and Signifiers tabs are all available.

![Available settings tabs](assets/settings/02-available-settings-tabs.png)

*Available settings tabs*

### ✓ clicking a tab swaps the active panel _(4669ms)_

1. Click the Tasks tab and confirm its panel comes to the front.
2. Switch to the Signifiers tab and confirm its panel replaces the previous one.

![Tasks settings panel](assets/settings/03-tasks-settings-panel.png)

*Tasks settings panel*

![Signifiers settings panel](assets/settings/04-signifiers-settings-panel.png)

*Signifiers settings panel*

---

## settings-config

Editing options through the settings dialog and confirming each change is saved: dropdowns, text fields, toggles, signifier and category management, and the task-flow drill-down.

### ✓ start-of-week dropdown persists _(3371ms)_

1. Set the start of the week to Monday from the General tab.

![Start-of-week dropdown set to Monday](assets/settings-config/01-start-of-week-dropdown-set-to-monday.png)

*Start-of-week dropdown set to Monday*

### ✓ a text field persists _(4780ms)_

1. Type a new journal-folder title into its text field.

![Journal-folder title text field](assets/settings-config/02-journal-folder-title-text-field.png)

*Journal-folder title text field*

### ✓ a toggle persists _(4891ms)_

1. Turn on the quarterly-notes toggle from the General tab.

![Quarterly-notes toggle switched on](assets/settings-config/03-quarterly-notes-toggle-switched-on.png)

*Quarterly-notes toggle switched on*

### ✓ a note-title pattern persists (Patterns tab) _(4985ms)_

1. Change the daily-note short title pattern on the Patterns tab.

![Daily-note title pattern field](assets/settings-config/04-daily-note-title-pattern-field.png)

*Daily-note title pattern field*

### ✓ adding a signifier persists and opens its editor _(5765ms)_

1. Add a new signifier, which appends it to the list and opens its editor.

![New signifier editor](assets/settings-config/05-new-signifier-editor.png)

*New signifier editor*

### ✓ adding then SAVING the editor keeps the list intact (3.0.1 regression) _(6252ms)_

1. Add a signifier and save its editor; the existing signifiers stay intact.

![Signifier list after saving a new entry](assets/settings-config/06-signifier-list-after-saving-a-new-entry.png)

*Signifier list after saving a new entry*

### ✓ removing a signifier persists _(4985ms)_

1. Remove a signifier from the list using its Remove button.

![Signifier list after removal](assets/settings-config/07-signifier-list-after-removal.png)

*Signifier list after removal*

### ✓ adding and removing a category persists (Tasks tab) _(6790ms)_

1. Add a task category on the Tasks tab, then remove it again.

![Task category editor](assets/settings-config/08-task-category-editor.png)

*Task category editor*

### ✓ task-flow drill-down and breadcrumb navigate _(27044ms)_

1. Drill into the Bullet Journal task flow to see its detail view.
2. Use the breadcrumb to return to the flow overview.

![Bullet Journal flow detail](assets/settings-config/09-bullet-journal-flow-detail.png)

*Bullet Journal flow detail*

---

## sidebar

The journal sidebar, your home base for picking a folder, browsing the calendar, and reaching secondary actions. It shows the active folder and mode, and in dynamic mode follows whichever journal note you open.

### ✓ sidebar shows the folder label and mode tag _(5975ms)_

1. Open a daily note and the sidebar; it shows the Journal folder and Dynamic mode.

![Sidebar with folder label and mode tag](assets/sidebar/01-sidebar-with-folder-label-and-mode-tag.png)

*Sidebar with folder label and mode tag*

### ✓ folder picker switches the selected folder _(6939ms)_

1. Use the folder picker to switch the sidebar to the Work journal folder.

![Sidebar showing the Work folder selected](assets/sidebar/02-sidebar-showing-the-work-folder-selected.png)

*Sidebar showing the Work folder selected*

### ✓ More… menu lists the expected actions _(6139ms)_

1. Open the sidebar More… menu to reveal its secondary actions.

![Sidebar More… menu actions](assets/sidebar/03-sidebar-more-menu-actions.png)

*Sidebar More… menu actions*

### ✓ toggling the mode from the menu persists it _(6762ms)_

1. Choose Switch to static from the More… menu to change the sidebar mode.

![Mode toggle in the More… menu](assets/sidebar/04-mode-toggle-in-the-more-menu.png)

*Mode toggle in the More… menu*

### ✓ dynamic mode follows the active note to its folder _(8637ms)_

1. In dynamic mode, opening a Work note makes the sidebar follow it to the Work folder.

![Sidebar following the active note](assets/sidebar/05-sidebar-following-the-active-note.png)

*Sidebar following the active note*

---

## folder-config

Per-folder configuration from the sidebar: turning a plain folder into a journal folder, and editing a folder’s own settings so they override the global defaults.

### ✓ Initialise a new journal folder creates a seeded journal-folder.md _(9380ms)_

1. Choose Initialise a new journal folder and pick the Inbox folder.

![Folder picker for initialising a journal folder](assets/folder-config/01-folder-picker-for-initialising-a-journal-folder.png)

*Folder picker for initialising a journal folder*

### ✓ Edit folder configuration writes a kebab-case override to front matter _(10349ms)_

1. Open Edit folder configuration to get the folder’s own settings form.
2. Override the daily-note title pattern for this folder only.

![Folder-config modal with an overridden pattern](assets/folder-config/02-folder-config-modal-with-an-overridden-pattern.png)

*Folder-config modal with an overridden pattern*

---

## ribbon-theme

The master journal menu, opened from the ribbon (and the main entry point on mobile), and the light/dark theme toggle it hosts for switching Obsidian’s colour scheme.

### ✓ the ribbon menu command opens the panel with actions _(2739ms)_

1. Open the journal ribbon menu and confirm it lists its actions.

![Ribbon menu panel](assets/ribbon-theme/01-ribbon-menu-panel.png)

*Ribbon menu panel*

### ✓ the theme toggle flips Obsidian’s color scheme _(3925ms)_

1. Use the ribbon menu’s theme toggle to flip Obsidian’s colour scheme.

![Theme toggle in the ribbon menu](assets/ribbon-theme/02-theme-toggle-in-the-ribbon-menu.png)

*Theme toggle in the ribbon menu*

---

<sub>Regenerate with `npm run release` (full pipeline) or `npm run test:e2e -- --report`. Do not edit by hand — it is overwritten on every release.</sub>
