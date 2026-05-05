# Settings resolution

All features extend `PluginFeature` (`src/data-access/plugin-feature.ts`). The important method is `getSettings(file, embeddedConfig)` — it asks `FolderSettingsResolver` to merge settings in this precedence order (later overrides earlier):

1. **Global settings** — from the plugin settings tab, persisted via `plugin.saveData`.
2. **Folder settings** — front-matter of a file named `journal-folder.md` *in the same folder as `file`*. Keys are converted via `camelCase` from `kebab-case`/`snake_case`/`Space Case` so users can write `journal-folder-title`, `JOURNAL_FOLDER_TITLE`, etc.
3. **Embedded config** — body of the current `journal-header` code block, parsed line-by-line as `key: value` and applied to that single header only.

When adding new configurable behavior, add the field to `JournalFolderSettings` + `DEFAULT_SETTINGS` in `src/data-access/journal-folder-settings.type.ts` and the resolver picks it up automatically across all three layers.

`FolderSettingsResolver.getFolderConfigFile` looks up `journal-folder.md` by exact path under `file.parent` — this is intentional so subfolders with the same name don't bleed settings into each other (see commit `663a8c9`).
