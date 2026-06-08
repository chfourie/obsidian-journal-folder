# E2E test plan

The canonical scenario matrix for the live-Obsidian end-to-end suite. Each row
maps a user-facing behaviour to the spec that exercises it and how it's asserted.
Status: ✅ implemented · ⬜ candidate (not yet automated).

Run: `npm run test:e2e:build` (see [README.md](README.md)). Every spec file lives
in `specs/` and is wired in `specs/index.mjs`.

## Coverage by feature area

### Smoke — `smoke.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Plugin loads | `app.plugins.plugins['journal-folder']` truthy | ✅ |
| 2 | Daily note renders the header | `.journal-folder-header` present | ✅ |
| 3 | Header is a no-op in a non-journal note | no header in active leaf | ✅ |

### Journal header — `header-nav.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Folder title + H1 render | text of folder-title / title | ✅ |
| 2 | Backward nav link targets previous day | `[data-jf-id="nav-backward"]` href contains prev date | ✅ |
| 3 | More popover opens, shows calendar toggle | `[data-jf-more-panel]` + `[data-jf-calendar-toggle]`; aria-expanded flips | ✅ |
| 4 | Header renders on a monthly note | `.journal-folder-header` present | ✅ |
| 5 | Previous-day note links forward to next day | `nav-forward` → 2026-06-06 | ✅ |

### Calendar (in-note) — `calendar.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Day cells + weekday header render | ≥28 `[data-jf-cell="day"]` | ✅ |
| 2 | exists/missing cell state classes | class on existing vs empty day | ✅ |
| 3 | Year/Month picker opens | `[data-jf-date-picker]`, 12 `[data-jf-month-select]` | ✅ |
| 4 | Past empty cell → confirm → note created | confirm `.mod-cta`; file created on disk | ✅ |
| 5 | Quarter cell gated by `quartersEnabled` | 0 off / ≥1 on | ✅ |
| 6 | prev/next arrows scroll months | next→Jul, prev→May cells appear | ✅ |
| 7 | Current link jumps to today's month | June cell back in view | ✅ |
| — | Note-month jump; sidebar single-month parity | | ⬜ |

### Task rendering — `tasks-render.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | In-note `journal-tasks` block renders rows | `[data-jf-task-list="note"]` + `[data-jf-task-item]` | ✅ |
| 2 | Plugin-rendered status icons | `[data-jf-status-icon]` present | ✅ |
| 3 | Document-body checkbox swap | `li[data-jf-doc-line]` + `[data-jf-doc-icon]` | ✅ |
| 4 | Sidebar task panel + scope trigger | `[data-jf-task-list="sidebar"]` + `[data-jf-scope-trigger]` | ✅ |
| 5 | Tasks grouped under source note | `[data-jf-task-group="note"]` | ✅ |
| 6 | Category section for matching tasks | `[data-jf-task-group="category"][data-jf-group-id="important"]` | ✅ |
| 7 | Truncation footer at the cap | `[data-jf-increase-cap]` with `tasksMaxItems:1` | ✅ |
| — | Group collapse/expand interaction | | ⬜ |

### Task status — `task-status.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Left-click cycles open→in-progress (disk) | note contains `- [/]` | ✅ |
| 2 | Right-click opens status picker | `[data-jf-status-picker]` + ≥3 options | ✅ |
| 3 | Picking a status persists | note contains `- [-]` | ✅ |
| 4 | Sidebar panel cycle writes to disk | note contains `- [/]` | ✅ |
| 5 | Theme-rendering flow keeps native checkbox | native input, no `[data-jf-doc-icon]` | ✅ |
| — | Self-cycling status opens picker on click | | ⬜ |

### Task migration — `task-migration.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | "Migrate to note" picker lists sibling tasks | `[data-jf-migrate-group]` / `[data-jf-migrate-task]`; confirm disabled | ✅ |
| 2 | Migrating stamps origin + copies to dest | origin `- [>]`, dest contains task, unticked untouched | ✅ |
| 3 | Cancel changes nothing | source file unchanged | ✅ |
| 4 | Cross-reference links written | origin→dest day, dest→origin day | ✅ |
| — | Reference opacity styling; `migrate-task-on-line` / `from-note` flows | | ⬜ |

### Migration-reference rendering — `migration-reference-render.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Live preview renders `lucide:` marker as icon | `.jf-migration-ref-live .jf-migration-ref-icon svg`; raw token gone | ✅ |
| 2 | Source mode keeps the raw token | no `.jf-migration-ref-live`; `lucide:redo-dot` shown in a `.cm-line` | ✅ |

### Task scope (sidebar) — `tasks-scope.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Scope summary reflects baseline | summary contains "Day" | ✅ |
| 2 | Panel opens with anchor/range/folders/filter | all four `[data-jf-scope-section]` | ✅ |
| 3 | Range change persists | `tasksSidebarRange` saved | ✅ |
| 4 | Anchor change persists | `tasksSidebarAnchor` saved | ✅ |
| 5 | All-folders persists | `tasksSidebarFolderMode` saved | ✅ |
| 6 | Show-completed toggle persists | `tasksShowCompleted` flips | ✅ |
| 7 | Quarter range gated by `quartersEnabled` | option absent/present | ✅ |

### Signifiers — `signifiers.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Reading-view gutter icons | `[data-sig-id="priority"]` / `"inspiration"` | ✅ |
| 2 | Matched tag hidden (reading) | `a.tag.jf-signifier-hidden-tag` | ✅ |
| 3 | margin-column adds column modifier | `.jf-signifier-column` | ✅ |
| 4 | per-row margin drops column modifier | gutter yes, column no | ✅ |
| 5 | Live-preview gutter marker | `.jf-signifier-gutter.jf-signifier-live [data-sig-id]` | ✅ |
| 6 | Source mode is raw (no gutter, tag verbatim) | no `.jf-signifier-gutter`, `#important` shown in a `.cm-line` | ✅ |
| 7 | Active-line reveal (live preview) | cursor line shows tag, other line hides it | ✅ |
| — | Reserve-gutter padding (measurement — unit-tested in computeReserve) | | ⬜ |

### Auto-template — `auto-template.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | New journal note seeded | note body contains template | ✅ |
| 2 | Non-journal note not seeded | no template content | ✅ |
| 3 | Disabled → empty | no template content | ✅ |
| 4 | Per-tier template selection | daily note uses daily-tier body | ✅ |

### Settings tab — rendering — `settings.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Tab strip renders | ≥4 `[data-jf-settings-tab]` | ✅ |
| 2 | Expected tabs exist | general/tasks/signifiers tabs | ✅ |
| 3 | Clicking a tab swaps the panel | `[data-jf-tab-panel="<id>"]` | ✅ |

### Settings tab — config editing — `settings-config.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Dropdown edit persists | `startOfWeek` → `monday` in data.json | ✅ |
| 2 | Text field edit persists | `journalFolderTitle` saved | ✅ |
| 3 | Toggle edit persists | `quartersEnabled` → true | ✅ |
| 4 | Moment-pattern edit persists (Patterns) | `dailyNoteShortTitlePattern` saved | ✅ |
| 5 | Add signifier persists + opens editor | `signifiers` +1, `[data-jf-editor-save]` | ✅ |
| 6 | Add→Save keeps list intact (3.0.1 regression) | pre-existing ids survive | ✅ |
| 7 | Remove signifier persists | `signifiers` −1 | ✅ |
| 8 | Add/remove category persists (Tasks) | `taskCategories` ±1 | ✅ |
| 9 | Task-flow drill-down + breadcrumb | flow detail ↔ overview | ✅ |

### Per-folder config — `folder-config.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Initialise a new journal folder | `journal-folder.md` seeded with title | ✅ |
| 2 | Edit folder config writes kebab front matter | `daily-note-short-title-pattern:` in config note | ✅ |

### Sidebar — `sidebar.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Folder label + mode tag | label "Journal", mode "Dynamic" | ✅ |
| 2 | Folder picker switches folder | label → "Work" | ✅ |
| 3 | More… menu lists actions | init-folder + mode-toggle items | ✅ |
| 4 | Mode toggle persists | `sidebarMode` = static | ✅ |
| 5 | Dynamic mode follows active note | label follows Work note | ✅ |
| (Initialise-folder + Edit-folder-config covered in `folder-config.spec.mjs`) | | | ✅ |

### Ribbon menu + theme — `ribbon-theme.spec.mjs`
| # | Scenario | Assertion | Status |
|---|----------|-----------|--------|
| 1 | Ribbon menu command opens panel | `[data-jf-ribbon-menu]` + items + theme item | ✅ |
| 2 | Theme toggle flips color scheme | `app.getTheme()` changes (restored after) | ✅ |

## Notes on remaining ⬜ candidates

Only a handful of low-value / awkward-to-automate cases remain ⬜:
- **Self-cycling status opens picker on click** — needs a task pre-seeded in a
  self-cycling status; the behaviour is unit-tested via `opensPickerOnClick`.
- **Reference opacity styling / `migrate-task-on-line` / `from-note` flows** —
  migration mechanics + cross-references are covered; these are extra entry
  points and a CSS opacity detail.
- **Reserve-gutter padding** and **live-preview tag-reveal edge cases** — the
  pure logic (`computeReserve`, `computeTagHideRanges`) is unit-tested; the DOM
  measurement is theme-dependent and brittle to assert exactly.
- **Group collapse/expand**, **note-month jump**, **sidebar single-month parity**.

Each is a straightforward addition using the same `ctx` helpers and `data-jf-*`
hooks — append a `[name, async (ctx)=>{…}]` entry to the relevant spec. The
fixtures already include the notes they'd need.
