# CLAUDE.md

> **Read [docs/agent-notes.md](docs/agent-notes.md) before non-trivial work.** It holds the
> durable, hard-won knowledge that isn't derivable from the code: maintainer conventions,
> vault topology, how to verify live behaviour via the Obsidian CLI, styling traps, the
> release flow, and design invariants. **When you learn something durable, append it there
> in the same change** — that file, not session memory, is the long-term record.

## Project

Obsidian community plugin (`id: journal-folder`). Any folder can act as a journal; notes named
`YYYY-MM-DD`, `gggg-[W]ww`, `YYYY-MM`, `YYYY` are daily/weekly/monthly/yearly entries.
Quarterly (`YYYY-Q[1-4]`) is an opt-in fifth tier gated by `quartersEnabled`, slotting between
yearly and monthly. The vault root is **not** supported as a journal folder (Obsidian
link-resolution).

Scripts are in `package.json`; tests live in `tests/`, mirroring `src/`. The non-obvious ones —
`npm run lint` (the community-review ruleset), `npm run deploy`, `npm run release`, and the
Obsidian CLI used to verify live behaviour — are documented in
[docs/agent-notes.md](docs/agent-notes.md).

## Architecture

Entry point `src/plugin/journal-folder-plugin.ts` instantiates a `PluginFeatureSet`
(`src/plugin/plugin-feature-set.ts`) — a lifecycle multiplexer whose `load` / `unload` /
`useSettings` / `onExternalSettingsChange` fan out to each registered feature with try/catch.
Adding a feature = subclass `PluginFeature` and `addFeature(...)` it.

| Feature | Role | Detail |
| --- | --- | --- |
| `JournalFolderSettingsFeature` | Owns + persists global settings, settings tab, propagation, global body-class side-effects (`applyStartOfWeek`, hide-config-notes, edit-mode indicator) | [settings-resolution.md](docs/settings-resolution.md) |
| `JournalHeaderFeature` | `journal-header` code block → in-note header + calendar | [header-ui.md](docs/header-ui.md), [calendar.md](docs/calendar.md) |
| `JournalTasksFeature` | `journal-tasks` code block + the shared `TaskCache`; task models, migration, status picker | [tasks-design.md](docs/tasks-design.md) |
| `JournalSignifiersFeature` | Tag → icon rendering in reading view + live preview; measured left-margin gutter | [signifiers.md](docs/signifiers.md) |
| `JournalAutoTemplateFeature` | Seeds new journal notes from template notes on vault `create` | [auto-template.md](docs/auto-template.md) |
| `JournalEditorFeature` | `start-new-line-below` command (delegates to Obsidian's own Enter keymap) | [agent-notes.md](docs/agent-notes.md) |
| `JournalFolderSidebarFeature` | Sidebar view: folder picker, calendar, config modal, init action, task panel | [sidebar.md](docs/sidebar.md) |
| `JournalRibbonMenuFeature` | The single plugin "home" ribbon icon + action menu | [agent-notes.md](docs/agent-notes.md) |
| `JournalTodayFeature` | One-click *Today* (menu item / ribbon icon / off) + `open-today` command | [agent-notes.md](docs/agent-notes.md) |

Feature `useSettings` invalidations are **diff-gated** by `src/data-access/settings-invalidation.ts`
— see agent-notes before adding a settings field.

### Settings resolution

Three layers, later overriding earlier: **global** → **folder front-matter** (`journal-folder.md`
in the file's own folder) → **embedded** `key: value` config in the current `journal-header`
block. Add a field to `JournalFolderSettings` + `DEFAULT_SETTINGS` in
`src/data-access/journal-folder-settings.type.ts` and the resolver picks it up.

- **Global-only** fields (`GLOBAL_ONLY_FIELDS`) aren't honoured at the folder/embedded layers —
  locale singletons, UI preferences, the process-wide task model. Per-field JSDoc carries the why.
- **`PER_FOLDER_FIELDS`** (`journal-folder-sidebar/folder-config-sync.ts`) is the canonical list
  the per-folder modal edits, typed `const satisfies ReadonlyArray<keyof JournalFolderSettings>`
  so drift is a type error. Notable folder-honoured exceptions to the `task*` prefix:
  `taskMigrationPlacement` / `taskMigrationHeading` / `taskMigrationHeadingLevel`, plus
  `includeInTodayPicker`.
- Details, key-case conversion, and the per-folder lookup nuance:
  [docs/settings-resolution.md](docs/settings-resolution.md).

### Journal note model

`src/data-access/journal-note.ts` picks a `JournalNoteStrategy` (daily/weekly/monthly/quarterly/
yearly) by regex-matching a `TFile` basename, then exposes the navigation, period, and
existence APIs the UI is built on — semantics in [docs/journal-note.md](docs/journal-note.md).
Use `isJournalFileBasename(basename, quartersEnabled)` when you only need the regex check
without instantiating a note.

`src/data-access/journal-folder-detection.ts` is the single source of truth for folder detection
(`FOLDER_CONFIG_FILENAME`, `findJournalFolderPaths`, `isJournalFolder`, `configPathFor`) — don't
re-derive config-note paths anywhere else.

## Conventions

- **Always write tests with functionality** — same change, no code-only changes. Mocks in
  `tests/mocks/obsidian.ts`.
- Every `.ts` / `.svelte` file opens with the **GPL-3.0 boilerplate** — match the existing style.
- Features import shared code from `'src/data-access'` (path alias via tsconfig `baseUrl: '.'`),
  which re-exports every module from its `index.ts`; a relative path is equally fine.
- Date formatting goes through the typed moment wrapper: `import { moment } from 'src/data-access'`
  — never from `'obsidian'` or `'moment'` (the raw obsidian export isn't typed callable).
- DOM globals use `activeDocument` / `activeWindow`, not bare `document` / `window`, for popout
  support (`obsidianmd/prefer-active-doc`; note it doesn't catch bare `window` — see agent-notes).
- Synthetic journal notes are plain `JournalNoteSource` objects (`basename` + `parent`) — never
  cast to `TFile` (a scanner-flagged pattern; the real `TFile` constructor also crashes on
  post-construction `path` assignment).
- Inline sidebar affordances are `<span role="button" tabindex="0">` with an Enter/Space
  `onkeydown`, not `<button>` (Obsidian's button chrome can't be cleanly overridden).
- `journal-folder-settings-tab.ts` is explicitly marked throwaway code — don't be surprised by its
  shape. Its `renderSettingsForm({ mode: 'global' | 'folder' })` entrypoint serves both the global
  tab and the per-folder `FolderConfigModal`.
