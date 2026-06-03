# Sidebar tab

A dedicated sidebar view collects journal-folder actions in one place. Open it with the calendar ribbon icon (left edge of the workspace) — the view docks in the right sidebar by default.

![Sidebar in dynamic mode](../screenshots/sidebar-dynamic.png)

The header reads **JOURNAL FOLDER (Dynamic)** or **JOURNAL FOLDER (Static)** — the parenthesised tag tracks the current mode at a glance. A single **More...** link to the right of that label opens every secondary action; the folder picker beneath it switches between known journal folders.

## Folder picker

Every folder that contains a `journal-folder.md` shows up in the picker. Click the dropdown trigger and Obsidian's native menu lists them all:

![Sidebar folder picker](../screenshots/sidebar-folder-picker.png)

In **dynamic** mode (the default), opening a journal note in a different folder switches the picker automatically — the calendar scrolls to that note's period and highlights its cell. In **static** mode the picker holds whichever folder you chose regardless of which note is open. Persists as the global `sidebar-mode` setting.

## Calendar

The calendar is the same single-month grid logic the in-note calendar uses, scoped to the selected folder. Clicking a day, week, month, quarter, or year cell opens (or creates) the corresponding journal note; past-dated cells with no existing note route through the same *Create missing note?* confirmation prompt the in-note calendar uses. The controls strip carries the same **Year/Month**, **Current**, and **Note month** quick-nav links as the in-note calendar, plus `‹` / `›` arrows for month-by-month navigation. In dynamic mode the calendar scrolls to follow the active note's period without clearing your manual `‹` / `›` history.

## Task panel

When the tasks feature is enabled (see [Tasks](tasks.md)), the sidebar gains a panel below the calendar listing tasks in the current scope. The panel header carries inline link toggles for **Today / Dynamic** and **Show completed / Hide completed**, and a `⋯` menu for scope-folder configuration and a jump to the plugin settings.

![Sidebar tasks panel](../screenshots/sidebar-tasks-panel.png)

## More... menu

A single text link to the right of the section header opens an Obsidian-native menu with every secondary action. The menu is built from the current sidebar state, so options that don't apply right now are simply omitted (e.g. *Switch to default folder* is hidden when you're already on the default; *Edit folder configuration* is hidden when no journal folder is selected).

![Sidebar More... menu](../screenshots/sidebar-more-menu.png)

Items:

- **Switch to dynamic / Switch to static** — flips the mode (also reflected in the section-header tag). Persists as the global `sidebar-mode` setting.
- **Switch to default folder** — resets the picker to the configured `default-journal-folder`. Shown only when you're on a non-default folder *and* the configured default still exists in the known list.
- **Set as default folder** — promotes the currently selected folder to the new global default. Shown only when the picker is on a non-default journal folder. The default folder itself has no global-settings-tab UI — set it from here.
- **Edit folder configuration** — opens a modal containing the same form rows as the plugin settings tab, but writing to the selected folder's `journal-folder.md` front matter instead of the plugin's `data.json`. Global-only fields (`start-of-week`, `hide-journal-folder-notes`, the *Sidebar* section, the destructive *Reset all* button) are hidden. Per-folder fields show their **effective** value (global merged with the folder's existing front matter), and edits are stored sparsely — fields that match the global config are *removed* from the front matter so subsequent global edits keep flowing through, while diverging fields are written as kebab-cased keys.
- **Initialise a new journal folder** — opens a fuzzy folder picker showing every folder that *isn't* already a journal folder (the vault root is excluded — it's not a supported journal folder elsewhere in the plugin). Picking a folder creates a `journal-folder.md` in it seeded with `journal-folder-title: <folder name>`, then switches the sidebar's selected folder to the new one.

## Hiding the config notes

`journal-folder.md` files are hidden from Obsidian's file tree by default — the **Hide `journal-folder.md` in file explorer** toggle in the plugin settings tab. They remain on disk and remain reachable through search and the *Edit folder configuration* action above; the *Edit folder configuration* form is the preferred way to change per-folder settings, so most users never need to see the raw config note. Turn the toggle off if you'd rather hand-edit the front matter directly in the file tree.
