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
link-resolution). TypeScript + Svelte 5 (runes), bundled by esbuild into a single `main.js`
(`esbuild-svelte` with `css: 'injected'`; `styles.css` ships separately).

## Commands

```bash
npm run dev        # esbuild watch → main.js
npm run build      # tsc --noEmit, then production build
npm test           # vitest run  (npm run test:watch for watch mode)
npm run lint       # eslint-plugin-obsidianmd — the community-review ruleset
npm run deploy     # build + copy into demo vault and deploy-targets.json vaults
npm run release -- <patch|minor|major>   # full local release pipeline
```

Tests live in `tests/`, mirroring `src/`. See [docs/agent-notes.md](docs/agent-notes.md) for the
lint ruleset details, the release pipeline, and the Obsidian CLI (`obsidian dev:dom` / `eval` /
`dev:screenshot`) used to verify live behaviour.

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
yearly) by regex-matching a `TFile` basename, then exposes navigation (`forwardInTime`,
`backInTime`, `closestSibling`, `getHigherOrderNotes`, `getLowerOrderNotes`, `getNotesInPeriod`),
predicates (`isPresentTime`, `isPast`, `isExistingNote`, `isToday`), and `hasUnit(unit)`.
`isJournalFileBasename(basename, quartersEnabled)` is the standalone regex check.
See [docs/journal-note.md](docs/journal-note.md).

`src/data-access/journal-folder-detection.ts` is the single source of truth for folder detection:
`FOLDER_CONFIG_FILENAME`, `findJournalFolderPaths`, `isJournalFolder`, `configPathFor`.

### Folder layout

```
src/
  plugin/         # entry point + feature lifecycle multiplexer
  data-access/    # settings types, FolderSettingsResolver, JournalNote, folder
                  # detection, moment wrapper, string utils, PluginFeature base
  features/       # one folder per feature: its *-feature.ts, Svelte components,
                  # and pure helpers
  ui/             # shared Svelte components (NoteLink, ErrorMessage)
docs/             # architecture deep-dives, screenshots, demo vault, agent notes
```

Every `data-access` module is re-exported from its `index.ts`; features import from
`'src/data-access'` (path alias via tsconfig `baseUrl: '.'`) or a relative path.

## Conventions

- **Always write tests with functionality** — same change, no code-only changes. Mocks in
  `tests/mocks/obsidian.ts`.
- Prettier: single quotes, 2-space indent, **no semicolons**, trailing commas `es5`, 80 cols.
- Every `.ts` / `.svelte` file opens with the **GPL-3.0 boilerplate** — match the existing style.
- Date formatting goes through the typed moment wrapper: `import { moment } from 'src/data-access'`
  — never from `'obsidian'` or `'moment'` (the raw obsidian export isn't typed callable).
- DOM globals use `activeDocument` / `activeWindow`, not bare `document` / `window`, for popout
  support (`obsidianmd/prefer-active-doc`; note it doesn't catch bare `window` — see agent-notes).
- Synthetic `TFile`s are duck-typed plain objects cast `as unknown as TFile` — the real `TFile`
  constructor crashes on post-construction `path` assignment.
- Inline sidebar affordances are `<span role="button" tabindex="0">` with an Enter/Space
  `onkeydown`, not `<button>` (Obsidian's button chrome can't be cleanly overridden).
- `journal-folder-settings-tab.ts` is explicitly marked throwaway code — don't be surprised by its
  shape. Its `renderSettingsForm({ mode: 'global' | 'folder' })` entrypoint serves both the global
  tab and the per-folder `FolderConfigModal`.
