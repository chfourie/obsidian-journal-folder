# Auto-template (new-note seeding)

`JournalAutoTemplateFeature` (in `src/features/journal-auto-template/`) listens to `vault.on('create')` and seeds new journal notes with a template body so users don't need Templater (or another helper plugin) just to drop a `journal-header` code block at the top of every new entry. Off by default; enable globally via the *Auto-fill new journal notes* toggle in the plugin settings tab, or per-folder via `auto-template-enabled: true|false` in that folder's `journal-folder.md` front matter.

Templates are stored as **ordinary notes with standardized filenames**, not as text in `data.json`. Each `journal-header`-bearing template note can be authored and previewed like a real journal entry.

## Trigger conditions

The fill only happens when **all** of these are true:

1. The created file is a markdown file (`extension === 'md'`).
2. The file's basename matches a journal pattern via `isJournalFileBasename(basename, quartersEnabled)` — same regexes the rest of the plugin uses.
3. The file's parent folder contains a `journal-folder.md` (looked up via `configPathFor(parent.path)` from `journal-folder-detection.ts`).
4. The resolved `auto-template-enabled` setting is truthy.
5. The file is empty at creation time (`vault.read(file).length === 0`) — existing content is never overwritten.

The vault `create` listener registers *after* `workspace.onLayoutReady` resolves, so the synthetic `create` events Obsidian fires during initial indexing don't stomp existing notes.

## Where templates live

Templates are notes with **standardized filenames** (not user-configured) — one per tier plus a cross-tier fallback:

```
daily-template.md  weekly-template.md  monthly-template.md
quarterly-template.md  yearly-template.md  default-template.md
```

Two locations hold them, both driven by global settings:

- **`templateFolder`** — a vault-wide template folder. Default `Templates/journal-folder` (plugin-namespaced so it won't clash with a user's own `Templates/` folder or another template plugin).
- **`templateOverrideFolderName`** — a subfolder *name* (default `Templates`), looked up *relative to each journal folder*, that overrides the global templates for that folder only. Drop a `monthly-template.md` into `<journalFolder>/Templates/` and it beats the global one. No per-folder setting is needed — the override is expressed by the files present.

A template note's body — **front matter included** — is copied verbatim into the new note.

## Resolution precedence

`resolveNoteTemplate` (in `template-resolution.ts`, shared by the create listener and the sidebar's *Re-populate note from template* action) reads candidates in order and returns the first whose content is non-empty (`firstNonEmptyTemplate` in `src/data-access/template-folder.ts`), or null when the file isn't a templateable journal note:

1. `<journalFolder>/<override>/<tier>-template.md` — per-journal override
2. `<journalFolder>/<override>/default-template.md`
3. body of `journal-folder.md` (front-matter stripped) — **legacy** per-folder template, still honoured
4. `<templateFolder>/<tier>-template.md` — global
5. `<templateFolder>/default-template.md`
6. built-in `DEFAULT_AUTO_TEMPLATE`

`templateCandidatePaths` builds the override + global path lists; the legacy config-note body is interleaved between them by the feature. Only the body is front-matter-stripped (it shares the file with the folder's config front matter); template *files* are copied verbatim.

`DEFAULT_AUTO_TEMPLATE` is `'%% JOURNAL NOTE %%\n\`\`\`journal-header\n\`\`\`\n'`. The leading `%% JOURNAL NOTE %%` Obsidian hidden-comment line is intentional: without it the cursor lands inside the code-block fence when toggling into edit mode and the block stops rendering until you click out. The comment doesn't render in reading mode and parks the cursor above the fence.

## Previewing a template note as the current period

A standardized template note isn't named with a journal pattern, so the `journal-header` block would normally render nothing in it. `JournalHeaderFeature.resolveHeaderNote` instead detects template notes (via `templateFileTier`, which checks the file sits in `templateFolder` or any journal folder's override subfolder and carries a standardized basename) and builds a **synthetic `JournalNote` for the *current* period of that tier** (`buildTemplatePreviewNote`). Editing `monthly-template.md` therefore previews exactly as this month's entry — header, calendar, and signifiers (signifiers already apply to all rendered markdown). `default-template.md` previews as a daily note.

Navigation links in a template preview are best-effort: for a note in the global `templateFolder` (which has no associated journal folder) they may resolve nowhere and are effectively inert.

## Migration from the legacy inline templates

Earlier versions stored template text in `data.json` (`autoTemplateContent`, `autoTemplatePerTier`, and the five `*NoteAutoTemplateContent` fields). On first load after upgrade `maybeMigrateInlineTemplates` runs once (gated by the `templatesMigratedToFiles` flag):

- `collectMigrationWrites` (pure) maps the legacy fields to template notes — per-tier mode → `daily-template.md` / `weekly-template.md` / … ; otherwise the generic `autoTemplateContent` → `default-template.md`. Empty fields are skipped. Migration keys off *content presence*, not `autoTemplateEnabled`, so a user who authored templates but turned auto-fill off keeps them.
- `runInlineTemplateMigration` ensures `templateFolder` exists and writes the notes, **never clobbering** an existing file. A `Notice` reports the count.
- The legacy field values are **left in `data.json`** as a backup (no longer read), and `journal-folder.md` bodies are **not** touched (they remain a working legacy source).

The settings tab grows a **Create template files** button (`scaffoldTemplateFiles`) that seeds any missing standardized notes in `templateFolder` with `DEFAULT_AUTO_TEMPLATE`, so users starting fresh have files to edit.

## Pure helpers

- `stripFrontMatter(source)` — strips a leading YAML front-matter block (both `\n` and `\r\n`).
- `isTruthySetting(value)` — accepts real booleans and the strings `"true"` / `"false"`.
- `DEFAULT_AUTO_TEMPLATE` — the built-in fallback.
- `src/data-access/template-folder.ts` — `TEMPLATE_FILENAMES`, `DEFAULT_TEMPLATE_FILENAME`, `isTemplateBasename`, `templatePreviewTier`, `templateFileTier`, `templateCandidatePaths`, `firstNonEmptyTemplate`, `currentPeriodBasename`, `buildTemplatePreviewNote`, `overrideFolderPath`.
- `migrate-inline-templates.ts` — `collectMigrationWrites`, `ensureFolderExists`, `runInlineTemplateMigration`.
- `template-resolution.ts` — `isTemplateableNote`, `resolveNoteTemplate` (the resolution path shared by the create listener and the sidebar *Re-populate note from template* action).

## Re-populating a note on demand

Beyond seeding on create, the sidebar **More...** menu offers **Re-populate note from template** when the active file is a journal note in a templating-enabled folder (`JournalFolderSidebarView.canRepopulate` → `isTemplateableNote` + resolved `autoTemplateEnabled`, surfaced as `ActiveFileSnapshot.repopulatable`). It re-runs `resolveNoteTemplate` for the note and **overwrites** its contents, after a destructive `confirmModal` (`src/ui/confirm-modal.ts`). Because it discards existing content it always confirms first; cancelling (or Esc / click-outside) is a no-op.

Unit tests: `tests/data-access/template-folder.test.ts`, `tests/features/migrate-inline-templates.test.ts`, `tests/features/template-resolution.test.ts`, `tests/features/auto-template-content.test.ts`, and the end-to-end create-event flow in `tests/features/journal-auto-template-feature.test.ts`.
