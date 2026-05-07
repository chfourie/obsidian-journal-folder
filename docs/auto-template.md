# Auto-template (new-note seeding)

`JournalAutoTemplateFeature` (in `src/features/journal-auto-template/`) listens to `vault.on('create')` and seeds new journal notes with a template body so users don't need Templater (or another helper plugin) just to drop a `journal-header` code block at the top of every new entry. Off by default; enable globally via the *Auto-fill new journal notes* toggle in the plugin settings tab, or per-folder via `auto-template-enabled: true|false` in that folder's `journal-folder.md` front matter.

## Trigger conditions

The fill only happens when **all** of these are true:

1. The created file is a markdown file (`extension === 'md'`).
2. The file's basename matches a journal pattern via `isJournalFileBasename(basename, quartersEnabled)` — same regexes the rest of the plugin uses.
3. The file's parent folder contains a `journal-folder.md` (looked up via `configPathFor(parent.path)` from `journal-folder-detection.ts`).
4. The resolved `auto-template-enabled` setting is truthy.
5. The file is empty at creation time (`vault.read(file).length === 0`) — existing content is never overwritten.

The vault `create` listener registers *after* `workspace.onLayoutReady` resolves, so the synthetic `create` events Obsidian fires during initial indexing don't stomp existing notes. Without that gate, opening a vault with the plugin would re-template every existing journal note that's currently empty.

## Template precedence

`resolveAutoTemplate(folderConfigBody, globalTemplate)` in `auto-template-content.ts` returns the first non-empty layer:

1. **Per-folder body** — the markdown body of `journal-folder.md`, after `stripFrontMatter` removes any leading `---\n…\n---` block. An empty body (whitespace only) falls through.
2. **Global setting** — `autoTemplateContent` from the plugin settings. Persists in `data.json`.
3. **Built-in default** — `DEFAULT_AUTO_TEMPLATE`, which is `'%% JOURNAL NOTE %%\n\`\`\`journal-header\n\`\`\`\n'`.

The leading `%% JOURNAL NOTE %%` Obsidian hidden-comment line is intentional: without it the cursor lands inside the code block fence when toggling into edit mode and the block stops rendering until you click out. The comment doesn't render in reading mode and parks the cursor above the fence.

## Why the `journal-header` block is harmless in non-journal notes

If a template body containing `\`\`\`journal-header\n\`\`\`` is pasted into `journal-folder.md` itself or any other regular note, the journal-header code block processor short-circuits and renders nothing — `JournalHeaderFeature.load`'s processor checks `isJournalFileBasename(currentFile.basename, quartersEnabled)` and bails if false. Errors only surface for malformed config, not for surrounding-filename mismatches. This makes template bodies portable between folders and safe to embed in the per-folder config note.

## Pure helpers

- `stripFrontMatter(source)` — strips a leading YAML front-matter block, recognising both `\n` and `\r\n` line endings.
- `resolveAutoTemplate(folderConfigBody, globalTemplate)` — the precedence chain above.
- `isTruthySetting(value)` — accepts both real booleans (from YAML) and the string `"true"` / `"false"` (from embedded `key: value` configs).
- `DEFAULT_AUTO_TEMPLATE` — the built-in fallback.

All four are exported from `src/features/journal-auto-template/index.ts` and unit-tested in `tests/features/auto-template-content.test.ts`. The end-to-end create-event flow is covered in `tests/features/journal-auto-template-feature.test.ts`.
