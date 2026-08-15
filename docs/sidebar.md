# Sidebar tab

`JournalFolderSidebarFeature` (in `src/features/journal-folder-sidebar/`) registers a view of type `journal-folder-sidebar` plus a `calendar-days` ribbon icon. The view (`JournalFolderSidebarView extends ItemView`) mounts `JournalFolderSidebar.svelte` into `contentEl` via Svelte 5's `mount` API. The Svelte component owns its own reactive state via `$state` runes; the view exposes a `SidebarUpdateApi` callback the component registers at mount, and pushes settings updates / known-folder lists / active-leaf snapshots / vault-tick bumps through it without ever re-mounting.

## Layout

Top-down inside the view:

1. **Header row** — `<JOURNAL FOLDER (Mode)>` on the left + `More...` link on the right. The mode tag is rendered in `var(--text-accent)` at `--font-medium` weight so the current mode (Dynamic / Static) is visible at a glance without opening the menu. The label's `text-transform: uppercase` doesn't cascade to the bracketed mode span because `.jf-sidebar-label-mode` sets `text-transform: none` to override.
2. **Folder dropdown** — a plain `<select class="dropdown">` listing every folder in the vault that contains a `journal-folder.md`. `background: transparent` so it blends with the sidebar surface; the border stays for affordance.
3. **Calendar** — `SidebarCalendar.svelte`, see [docs/calendar.md](calendar.md) *Sidebar embed* for the model. Hidden when no journal folder is selected, with a help row explaining how to initialise one via the More... menu.

The bottom action row (Edit folder configuration / Initialize a new journal folder) that earlier iterations had below the calendar is gone — both actions live exclusively in the More... menu now.

## More... menu

`More...` opens `SidebarMenuPanel.svelte` — a `<body>`-portaled styled panel (matching the task scope panel's look) rather than an Obsidian-native `Menu`. It's populated from the current state by `buildMenuItems()` (passed as a lazy `getItems` callback so visibility/labels reflect state at open time). Each row renders its Lucide icon through Obsidian's `setIcon`. Items are gated so only options that actually apply right now appear:

- **Switch to dynamic / Switch to static** — always present, label flips with the current `sidebarMode`.
- **Switch to default folder** — included only when the picker is on a non-default folder *and* the configured default still exists in the known list.
- **Set as default folder** — included only when the picker is on a non-default journal folder. Promotes the currently selected folder to the new global default by mutating `defaultJournalFolder` through `JournalFolderSettingsFeature.saveSettings` (which is `public readonly` on the settings feature for exactly this reason).
- **Edit folder configuration** — included only when the selected folder is in the known journal-folders list. Opens `FolderConfigModal` against the selected folder's `journal-folder.md`.
- **Initialise a new journal folder** — always present. Opens `InitJournalFolderModal` (a `FuzzySuggestModal<TFolder>`) listing every folder that isn't already a journal folder.
- **Re-populate note from template** — included only when the *active* file (not the selected folder) is a journal note in a templating-enabled folder. The view computes this as `ActiveFileSnapshot.repopulatable` (resolved per-folder `autoTemplateEnabled` + `isTemplateableNote`) so the item appears/disappears as the active leaf changes. Clicking it overwrites the note with its resolved template (`resolveNoteTemplate`, the same path the auto-template create listener uses) after a destructive confirmation (`confirmModal`, `mod-warning` button) — it's the one menu action that mutates note *content*, so it always confirms first.

Separators are inserted between the mode item, the default-folder group, the per-folder/initialise group, and the re-populate item; the `buildMenuItems()` flow skips the trailing separator for an empty group rather than emitting orphans.

The panel is right-aligned under the More... link (`left = trigger.right − panelWidth`, clamped ≥8px from the viewport edge) and closes on click-outside / Escape / scroll, repositioning on scroll/resize. The **folder picker** beneath the header still uses the Obsidian-native `Menu` via the component's `showMenu` prop → the view's `showMoreMenu(rect, items)` (which does the same right-align trick by shifting `menu.dom`); only the More... menu moved to the styled panel.

## Modes

`sidebarMode: 'static' | 'dynamic'` is a global-only setting (the sidebar is a singleton; per-folder/embedded overrides would be inconsistent). Dynamic (default) subscribes to `workspace.on('active-leaf-change')`; when the active file is a recognised journal note (`isJournalFileBasename(basename, quartersEnabled)`) in a *known* journal folder, two things happen: the sidebar's selected folder switches to the file's parent (when different), and the calendar's anchor + offset reset so the file's period is centred. Static mode ignores the event entirely.

The dynamic-mode rules are pure-helper'd in `sidebar-selection.ts` (`resolveSelectedFolder`, `resolveDynamicSelection`) and unit-tested across all six branches.

## Anchor note synthesis

`buildAnchorNote(app, folderPath, anchorBasename, settings)` (in `sidebar-anchor.ts`) constructs a `JournalNote` rooted in an arbitrary folder by passing a duck-typed plain object — *not* `new TFile()` — to `journalNoteFactoryWithSettings`. The factory only reads `file.basename` and `file.parent`, so the duck-type is sufficient and bypasses Obsidian's real `TFile` constructor (which wires `path` through an internal `setPath` that crashes on post-construction assignment). Returns `null` for unknown folders, unrecognised basenames, or quarterly basenames when quarters are disabled.

The synthetic anchor's `noteNames` array is captured *once* at construction (the factory reads `file.parent.children` immediately), so the calendar's existence flags would go stale on vault mutations. The fix is `vaultTick` — a `$state(0)` in the Svelte parent that's incremented via the `bumpVault` API on every `vault.on('create' | 'delete' | 'rename')`. The anchor's `$derived.by` reads `vaultTick` (just `void vaultTick`), which forces the derived to recompute and rebuild the synthetic JournalNote against the live `parent.children`.

## Initialise action

`InitJournalFolderModal` (a `FuzzySuggestModal<TFolder>`) opens with candidates from `findInitialisableFolders(app)` — every TFolder that isn't the vault root and isn't already a journal folder. On pick, `initialiseJournalFolder(app, folder)` creates `journal-folder.md` seeded with `journal-folder-title: <folder name>` (idempotent — returns the existing TFile if one is already there). The view then calls `refreshKnownFolders()` and `setSelected(newPath)` so the sidebar lands on the freshly initialised folder.

`buildDefaultJournalFolderConfig(folderName)` is the seed string and is exported from `init-journal-folder.ts` so it's testable in isolation. The empty-candidates state in the modal carries dedicated placeholder text (*"No eligible folders — every non-root folder is already a journal folder."*) so users hitting the action with nothing to pick aren't left wondering.

## Edit folder configuration

`FolderConfigModal` uses the folder-only `renderSettingsForm(...)` entrypoint (in `folder-settings-form.ts`; the *global* tab renders declaratively via `getSettingDefinitions()` and no longer shares this renderer). Reads the effective settings via `getCurrentSettings: () => readEffectiveSettings(file)`, which overlays the folder's front-matter cache (filtered to keys whose camelCase form is a known `JournalFolderSettings` field) onto the live global settings. Saves via `saveSettings: (s) => saveToFrontMatter(file, s)`, which runs the new settings through `computeFrontMatterDiff(newSettings, globalSettings)` (in `folder-config-sync.ts`) and applies the partition through `app.fileManager.processFrontMatter`:

- Keys whose new value matches the global config land in `diff.remove` and are deleted from front matter, so future global edits flow through.
- Keys that diverge from global land in `diff.set` (kebab-cased) and are written.

### The per-field "Default" (inherit) choice

Sparse saving alone left inheritance invisible — a row showed the effective value with no way to tell an inherited value from an explicit override, and no way to *un*-override short of hand-editing the front matter. Folder mode therefore passes two extra callbacks into `renderSettingsForm`: `getGlobalSettings` (the config the folder inherits from) and `getOverriddenFields` (`readOverriddenFields`, the camelCase field keys the folder's front matter actually sets). With those, each overridable row renders inheritance as a literal option:

- **Enums** — a `Default (<global label>)` option ahead of the concrete values.
- **Booleans** — a Default / On / Off dropdown instead of a toggle.
- **Text / moment patterns** — a Default / Custom gate; the real input renders only under *Custom*.

Picking *Default* writes the **global value** into the settings object, which `computeFrontMatterDiff` then routes to `diff.remove` — no new save path, the existing sparse diff does the erasing. The override set comes from the front matter rather than from comparing values, because a deliberate override may legitimately equal the global value mid-edit. Freshly-picked *Custom* fields (still equal to global, so not yet in front matter) are tracked in `folderCustomText` for the lifetime of the open modal so the input doesn't snap shut on re-render. The **global** settings tab is unchanged — it has nothing to inherit from.

`PER_FOLDER_FIELDS` is the canonical list of fields the modal lets users edit, typed as `const satisfies ReadonlyArray<keyof JournalFolderSettings>` so adding a new settings field without an entry trips a type error. The diff helper handles the boolean-vs-stringified-boolean mismatch (`true` in JS vs `"true"` in YAML, which `FolderSettingsResolver` already coerces) so opening and closing the modal without changes doesn't churn the front matter.

## File-explorer hide

The global *Hide journal-folder.md in file explorer* setting (`hideJournalFolderNotes`, on by default) toggles a `journal-folder-hide-config-notes` body class on every `saveSettings` call (and removes it on `unload()`). A CSS rule in `styles.css` then declaratively hides the matching `.nav-file` rows:

```css
body.journal-folder-hide-config-notes
    .nav-file:has(> .nav-file-title[data-path$="/journal-folder.md"]),
body.journal-folder-hide-config-notes
    .nav-file:has(> .nav-file-title[data-path="journal-folder.md"]) {
    display: none !important;
}
```

The unscoped `.nav-file` works because there are no `.nav-file` elements outside file explorers; an earlier iteration tried scoping under `.workspace-leaf-content[data-type="file-explorer"]` but Obsidian's DOM doesn't always nest the explorer under that attribute (popout windows, mobile). No `MutationObserver` needed.
