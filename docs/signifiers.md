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
global `signifierPlacement` setting. Both values are left-margin gutters
(physical-journal style):

- **`margin`** — the icon hangs in the **margin just left of each entry**
  (indented with nesting).
- **`margin-column`** (**default**) — **every** icon aligns in **one far-left
  column** regardless of nesting (a physical journal's left rule).

Both modes make the entry's content host / line a positioning context
(`.jf-signifier-host`) and absolutely position the marker, vertically centred
on the line (`height: 1lh; align-items: center`). **Both axes are measured, not
CSS constants** — that's what makes them theme-robust, where a fixed offset
overlapped restyled bullets/checkboxes (e.g. under AnuPpuccin) or floated above
padded headings.

- **Horizontal** — the old fixed `translateX(-100%)` offset overlapped restyled
  bullets, so `left` is measured (see below).
- **Vertical** — CSS `top: 0` resolves to the host's **padding-box** top, which
  on a padded block (Obsidian gives heading lines `padding-top: var(--p-spacing)`
  in the editor; some themes pad headings in reading view) sits well above the
  first glyph — so the centred-in-`1lh` icon floated in that padding strip. The
  positioner now measures the host's top-padding and writes it as inline `top`,
  dropping the icon onto the actual text line. `0` for unpadded blocks (the
  common case), so it's inert wherever signifiers already aligned.

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
  `docChanged / viewportChanged / geometryChanged` (the last covers resize). For
  the per-row (`margin`) target it anchors on the line's **rendered bullet**
  (`.cm-formatting-list`) rather than `coordsAtPos`, because the marker
  character's coordinate sits ~one indent step right of the visible bullet
  (further off when the Outliner plugin restyles lists); non-list lines fall back
  to the content coordinate.

There is **no scroll recompute** (the offset is scroll-invariant). Markers are
`visibility: hidden` until their first measurement reveals them
(`.jf-positioned`) so there is no wrong-x flash. Because the horizontal
position is measured from the live layout, both placements hold up across
themes, snippets and indentation settings — which is why they are the only two
placement options.

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
| Reading view | `processSignifiers` post-processor (`process-signifiers.ts`) inserts a `.jf-signifier-gutter` marker into the tag's nearest block ancestor (`li` / `p` / heading / …), made the positioning host | Tag hidden when `signifierHideTagInReadingView`; otherwise the tag stays too |
| Live preview | `signifierLivePreviewExtension` CodeMirror `ViewPlugin` (`signifier-live-preview.ts`) adds a side `-1` gutter widget per line, positioned by measurement | Tag hidden when `signifierHideTagInLivePreview` (via a `replace` decoration), **revealed while the cursor / selection touches it** so it stays editable; otherwise the tag stays |
| Source mode | **Fully inert.** The same `ViewPlugin` runs in Source mode too, but it gates on Obsidian's `editorLivePreviewField` (`isLivePreview`) and emits `Decoration.none` + releases any reserved lane — no gutter icons, no add affordance, **no tag-hiding**. Source mode is a raw editing experience; the matched tag text must stay visible. The extension rebuilds on a Live Preview ⇄ Source toggle (tracked as `lastLivePreview`, treated like a settings change) | Tag always visible (raw markdown) |
| Plugin task lists | `TaskItem.svelte` renders `task.signifierIds` inline via `renderSignifierIcon` | Always hidden (tags stripped from `displayText` at extract time) |

**Why measurement, not fixed CSS:** both modes absolutely-position the icon
into the left margin. An earlier version used a fixed `translateX` offset,
which looked right in a pristine vault but broke in real ones — CSS snippets
and themes (e.g. AnuPpuccin, Minimal, list/checkbox/indent-guide snippets)
restyle list layout and shift the reference frame, so the icon could land on
top of the checkbox or off-screen. Measuring the live layout instead (and
reserving the lane) makes the gutter robust across themes/snippets — which is
why these two left-margin modes are the only placement options.

| Surface | Mechanism |
| --- | --- |
| Reading view | `.jf-signifier-gutter` absolutely positioned against the entry's content host (`.jf-signifier-host`); `left` measured by `gutter-positioner.ts`. `margin-column` adds `.jf-signifier-column` |
| Live preview | side `-1` widget absolutely positioned against the line (`.jf-signifier-host` line decoration); `left` measured via `coordsAtPos` |

Live preview always renders the gutter widget. When `signifierHideTagInLivePreview`
is on (the default), each matched tag token is hidden with a `Decoration.replace`,
**except** when the tag is revealed for editing. The reveal scope is the global
`signifierShowTagsOnActiveLine` toggle (off by default): on — the cursor / a
selection anywhere on a line reveals **all** of that line's tags; off — only the
tag the selection actually touches is revealed. The decision is the pure,
unit-tested `computeTagHideRanges` (returns the ranges to hide). The decoration
set is rebuilt on `selectionSet` (only when tag-hiding is on). Soft breaks within
one CodeMirror line don't arise (each editor line is its own line), so the
reading-view `<br>` line-splitting has no editing-view counterpart.

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
  `icon`, optional `maxRange` (a **range cap**). Stored as an **ordered**
  array; the settings order is the section order.
- Default: an **Important** category bound to `#important` — the same tag as
  the Priority signifier.
- A task matching several categories appears under **every** matching category
  (`groupTasksByCategory`, pure/tested). Tags matched by a signifier *or* a
  category are stripped from the task's `displayText`.
- The single global toggle `taskCategoryShowUnderNote` decides whether a
  categorized task **also** appears in its note group below the categories.
  Uncategorized tasks always appear under their note.

### Range cap (`maxRange`)

A category may pin its tasks to a **maximum range** (`day` / `week` / `month` /
`quarter` / `year`; unset = no cap). The cap bounds how far the task reaches in
a list, measured from the **same anchor** the list uses (today, or the active
note when anchored on it):

- In a list whose range is **larger** than the cap (or `all`), the cap's range
  is used for that task instead; a **smaller** list range still wins.
- When a task is in several capped categories, the **smallest** cap applies.
- **Note-anchored floor:** when the list is measured from a note — the sidebar's
  *Current note* anchor, and every in-note `journal-tasks` block — the cap is
  floored up to the note's own tier (`largerRangeUnit(cap, noteTier)`), mirroring
  the floor `buildReferenceRange` applies to the reference range. A note bigger
  than a day spans a date range, not a single anchor instant, so a cap finer than
  the note tier stops biting (a Day cap behaves like a Month cap on a monthly
  note). The floor is **not** applied to the *Today* anchor, where caps measure
  from today at their configured grain. Passed as `makeRangeCapFilter`'s
  `floorUnit`.
- The cap only filters the aggregated lists (sidebar panels + the in-note
  `journal-tasks` block). The task still renders as a normal checkbox in its own
  note.

Implemented in `task-range-cap.ts` (pure/tested): `makeRangeCapFilter({ base,
listUnit, categories })` returns a `(task, noteRange) → boolean` predicate. The
cap is applied per candidate during task collection in `computeTaskSnapshot`
(sidebar) and the in-note block's `render` — both already hold the list anchor
`base` and range unit. A cap that isn't strictly smaller than the list range is
a no-op (the task is left to normal candidate filtering); when it bites,
inclusion is re-tested with `rangesIntersect(noteRange, periodAround(base,
cap))`. There is **no** built-in/default capped category — users add their own
(e.g. a `#local` category capped to `day`).

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
