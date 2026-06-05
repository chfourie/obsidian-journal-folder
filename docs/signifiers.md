# Signifiers & task categories

Two BUJO-inspired, **global-only** features built on the plugin's existing
icon/colour infrastructure (`IconSpec`, `ColorRef`, the Lucide/emoji pickers,
the colour-token palette). Neither is overridable per task-flow or per folder
— the dictionaries in global settings are the single source of truth, and
both keys live in `GLOBAL_ONLY_FIELDS` (`src/data-access/folder-settings-resolver.ts`).

## Signifiers

A **signifier** binds an icon to one or more tags. Where a configured tag
(e.g. `#important`) appears, the tag is replaced by — or annotated with — the
signifier's icon. Signifiers apply to **any** rendered markdown, not just
tasks or bullets.

- Type: `Signifier` (`src/data-access/signifier.type.ts`) — `id`, `label`,
  `tags` (bare names, `tags[0]` is the *primary* tag), `icon: IconSpec`.
- Defaults: the three standard BUJO signifiers — **Priority** (`#important`,
  `star`), **Inspiration** (`#inspiration`, `lightbulb`), **Explore**
  (`#explore`, `eye`). Lucide icons honour `icon.color`; emoji ignore it.
- A line can carry several signifiers (several tags) — each renders its own
  icon, in signifier-configuration order.

### Where they render

In **notes** (reading view and live preview) the placement is set by the
global `signifierPlacement` setting:

- **`start`** — the icon **leads the entry** in normal text flow
  (`★ ☐ Downgrade Claude?`).
- **`end`** — the icon **trails the line** in normal text flow.
- **`margin`** — the icon hangs in the **margin just left of each entry**
  (indented with nesting), physical-journal style.
- **`margin-column`** (**default**) — **every** icon aligns in **one far-left
  column** regardless of nesting (a physical journal's left rule).

Both margin modes make the entry's content host / line a positioning context
(`.jf-signifier-host`) and absolutely position the marker, vertically centred
on the line (`top: 0; bottom: 0; align-items: center`). Their **horizontal**
position is set by **measurement, not CSS constants** — that's what makes them
theme-robust, where the old fixed `translateX(-100%)` offset overlapped
restyled bullets/checkboxes (e.g. under AnuPpuccin).

**Why measurement is robust *and* cheap:** a marker's `left = targetX −
hostLeft`, and both are page coordinates of elements inside the same
positioned/scrolling container, so they move together. The offset is therefore
invariant to scroll and to readable-width re-centring — it only changes when
intrinsic layout metrics change (theme, font, the DOM itself).

- **Reading view** — `gutter-positioner.ts` batches all `getBoundingClientRect`
  reads, then all `left` writes, inside one `requestAnimationFrame` (one
  reflow). Scheduled after the post-processor, on `workspace.on('css-change')`
  (theme), and — for the single column only — on `on('resize')`. Per-row target
  is the entry's own bullet/checkbox left; the column target is just left of the
  leftmost entry across the note.
- **Live preview** — the `ViewPlugin` measures with CodeMirror's `coordsAtPos`
  inside a batched `view.requestMeasure`, driven by `update()` on
  `docChanged / viewportChanged / geometryChanged` (the last covers resize).

There is **no scroll recompute** (the offset is scroll-invariant). Markers are
`visibility: hidden` until their first measurement reveals them
(`.jf-positioned`) so there is no wrong-x flash. Because the horizontal
position is measured from the live layout, the margin placements hold up across
themes, snippets and indentation settings — which is why `margin-column` is the
default rather than a warned opt-in.

**Reserve left margin for gutter signifiers** (`signifierReserveGutter`, **off
by default**, margin modes only): when on, the content container's
`padding-inline-start` is set to `max(theme padding, widest icon stack + gap)`
— enough room that icons never clip even with readable line width off or a
narrow view. It's `max`, not an addition, so it doesn't stack on the theme's
existing margin; and the reserve is the *intrinsic* widest-stack width
(measured once per pass), so it can't oscillate. When off (or on a flow
placement) the lane is released and icons hang into whatever margin exists. The
per-container base padding is cached in a `WeakMap` (read before we override
it) so re-applying never compounds.

| Surface | Mechanism | Tag visibility |
| --- | --- | --- |
| Reading view | `processSignifiers` post-processor (`process-signifiers.ts`) inserts a `.jf-signifier-lead` marker at the start of the tag's nearest block ancestor (`li` / `p` / heading / …), after a task checkbox when present | Tag hidden when `signifierHideTagInReadingView`; otherwise the tag stays too |
| Live preview | `signifierLivePreviewExtension` CodeMirror `ViewPlugin` (`signifier-live-preview.ts`) adds a side `-1` in-flow lead widget per line | Tag is **never hidden** — it stays fully editable |
| Plugin task lists | `TaskItem.svelte` renders `task.signifierIds` inline via `renderSignifierIcon` | Always hidden (tags stripped from `displayText` at extract time) |

**Why measurement, not fixed CSS:** the margin modes absolutely-position the
icon into the left margin. An earlier version used a fixed `translateX` offset,
which looked right in a pristine vault but broke in real ones — CSS snippets
and themes (e.g. AnuPpuccin, Minimal, list/checkbox/indent-guide snippets)
restyle list layout and shift the reference frame, so the icon could land on
top of the checkbox or off-screen. Measuring the live layout instead (and
reserving the lane) makes the margin modes robust enough to be the default; the
flow placements (`start` / `end`) remain as zero-measurement alternatives that
sit in the line rather than hanging in the margin.

| Surface | start / end | margin / margin-column |
| --- | --- | --- |
| Reading view | `.jf-signifier-lead` / `.jf-signifier-trail` inserted in flow (after the checkbox, inside the content `<p>`) | `.jf-signifier-gutter` absolutely positioned against the entry's content host (`.jf-signifier-host`); `left` measured by `gutter-positioner.ts`. `margin-column` adds `.jf-signifier-column` |
| Live preview | side `-1` / side `1` in-flow widget | widget absolutely positioned against the line (`.jf-signifier-host` line decoration); `left` measured via `coordsAtPos` |

Live preview uses a plain CodeMirror side `-1` widget (the idiomatic,
non-destabilising mechanism — nothing hidden or replaced) and is gated by
`signifierLivePreviewEnabled` (default on). That toggle is a deliberate
kill-switch: turning it off reverts live preview to plain tags with reading
view and task lists unaffected.

### Modify signifiers on the current line

`JournalSignifiersFeature` registers the command **"Modify signifiers on
current line…"** (and an `editor-menu` item). It opens `SignifierPickerModal`
pre-checked with the signifiers already on the line; on apply,
`computeSignifierLineEdit` (`signifier-line-edit.ts`, pure/tested) appends the
**primary** tag of newly-selected signifiers and strips **all** tags of
de-selected ones, leaving other tags and the task text untouched.

## Task categories

A **task category** groups tasks by tag at the top of every task list (the
in-note `journal-tasks` block and both sidebar panels).

- Type: `TaskCategory` (`signifier.type.ts`) — `id`, `label`, `tags`, optional
  `icon`. Stored as an **ordered** array; the settings order is the section
  order.
- Default: an **Important** category bound to `#important` — the same tag as
  the Priority signifier.
- A task matching several categories appears under **every** matching category
  (`groupTasksByCategory`, pure/tested). Tags matched by a signifier *or* a
  category are stripped from the task's `displayText`.
- The single global toggle `taskCategoryShowUnderNote` decides whether a
  categorized task **also** appears in its note group below the categories.
  Uncategorized tasks always appear under their note.

`groupTasksByCategory(tasks, categories, showUnderNote)` returns
`{ categorySections, noteTasks }`; `TaskList.svelte` renders the category
sections above the note groups, keying their collapse state as `cat:<id>` in
the shared `collapsedNotePaths` set so it never collides with note paths. Tasks
inside a category section show a source-note chip (`noteTitleShort`) since the
note header is absent there.

## Settings editor

`renderSignifiersSection` / `renderCategoriesSection`
(`src/features/journal-folder-settings/signifier-category-editor.ts`). Signifiers
get their **own settings tab** ("Signifiers") because they are a feature in
their own right; task **categories** live under the Tasks tab since they only
shape task lists. Both are global-only (suppressed in the per-folder modal) and
provide an add button, reorder arrows, and a per-item edit modal reusing
`renderColorPicker` (Lucide only) and the `LucidePickerModal` /
`EmojiPickerModal` pickers.
