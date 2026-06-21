# Gutter-collision offsets — design

**Status:** Draft / not yet implemented
**Author:** Charl Fourie (with Claude)
**Created:** 2026-06-21
**Related code:** `src/features/journal-signifiers/gutter-positioner.ts`,
`src/features/journal-signifiers/signifier-live-preview.ts`,
`src/features/journal-tasks/document-task-live-preview.ts`,
`src/data-access/journal-folder-settings.type.ts`
**Related commit (already shipped, NOT this doc):** `0dff3c9` — *Fix
reading-view task icon click-through on collapsible tasks*.

> This document is intentionally self-contained: it captures the full problem,
> the measurements, the options weighed, the decisions already made, and the
> questions still open — so the work can be picked up cold, weeks later, without
> re-discovering any of it.

---

## 1. TL;DR

When a list entry is **collapsible** (has children, so Obsidian draws a
fold/collapse toggle) or when content sits at the line's text origin, Obsidian's
own gutter glyph collides with the plugin's left-margin elements:

- **Reading view:** the fold toggle overlaps the **signifier** icon. *(user
  screenshot "image #3")*
- **Live preview:** the fold toggle overlaps both the **signifier** icon and the
  **task status icon**. *(user screenshot "image #2")*

Neither is a regression — both predate commit `0dff3c9` (verified, see §4.3).
There is **no clean, theme-robust, side-effect-free** automatic fix: every
remedy moves one element by a theme-dependent amount.

**Decision:** add an **opt-in, default-off, user-tunable offset** that shifts the
plugin's margin elements clear of the colliding glyph. Off ⇒ byte-identical to
today. Measured/additive (not a hard-coded CSS constant). Editor line numbers
are an explicit **non-goal** (§8).

---

## 2. Background — how signifier gutters are positioned today

(See also `docs/signifiers.md`.)

A **signifier** binds an icon to a tag; where the tag appears, the icon is shown.
In notes, `signifierPlacement` controls where:

- **`margin`** — icon hangs in the margin just left of *each* entry (follows
  indentation).
- **`margin-column`** (default) — *every* icon aligns in one far-left column
  regardless of nesting.

Both modes absolutely-position a `.jf-signifier-gutter` marker relative to a
positioning host (`.jf-signifier-host`) and **measure** its `left` rather than
using CSS constants — this is what makes it theme-robust (a fixed offset
overlapped restyled bullets/checkboxes under some themes). Key facts:

- **Reading view** positioner: `gutter-positioner.ts` →
  `positionReadingGutters()` / `scheduleReadingGutters()`. It finds each row's
  visible marker via
  `ROW_START_SELECTOR = 'input.task-list-item-checkbox, .jf-task-status, .list-bullet'`
  (`rowStartLeftOf()`), then parks the signifier `ROW_GAP_PX` (12px) left of it
  (`computeRowLeft()`), shifted left by its own width via CSS `translateX(-100%)`.
- **Live preview** positioner: `signifier-live-preview.ts` → `measureGutterLefts()`
  (a CM6 `ViewPlugin`). It anchors on the line's rendered list marker
  (`.cm-formatting-list`) when present, else falls back to `coordsAtPos`.
- **Column mode** anchor: `columnAnchorX()` takes the **min `rowStart` across all
  rows** minus `COLUMN_INSET_PX` (8px). ⇒ one row reaching further left drags the
  **whole column** left.
- **Reserve:** when `signifierReserveGutter` is on, `computeReserve()` reserves
  only the *deficit* by which the leftmost icon would clip past the pane's clip
  edge, clamped by `maxGutterReserve()` (a safety bound so a transient
  mis-measurement can't push content off-screen).

These constants live at the top of `gutter-positioner.ts`:
`ROW_GAP_PX = 12`, `COLUMN_INSET_PX = 8`, `EDGE_MARGIN_PX = 4`.

Signifier settings are **global-only** (not per-folder / per-flow). Keys live in
`journal-folder-settings.type.ts`; global-only enforcement in
`folder-settings-resolver.ts` (`GLOBAL_ONLY_FIELDS`). Defaults:
`signifierPlacement: 'margin-column'`, `signifierReserveGutter: true`.

---

## 3. The two problems

Both involve **Obsidian's fold/collapse affordance**, which only appears for
entries that have children, and (for expanded entries) only on hover.

### 3.1 Image #3 — reading view: fold toggle overlaps the signifier

Obsidian draws `.list-collapse-indicator` — a `position: absolute` box ~42px
wide, with its glyph at the left ~10px — in the gutter just left of the entry
content. The signifier, parked 12px left of the checkbox, lands in the same band.

### 3.2 Image #2 — live preview: fold toggle overlaps the signifier AND the status icon

Two distinct overlaps on the same row:

- **signifier ↔ fold** — same root cause as §3.1.
- **status icon ↔ fold** — the live-preview status icon (a CM widget,
  `.task-list-label`) sits at the line's text origin; Obsidian's fold glyph
  (`.cm-fold-indicator` anchor + the hover `.collapse-indicator`) right-aligns to
  that same origin and grows left, so its right edge clips the icon's left edge.

  **Important:** the status icon is already in the **right** place — it sits at
  the *same* x on collapsible and non-collapsible rows (measured 319 for both,
  §11). It is the fold glyph that intrudes. So "fixing" the icon means either
  moving the icon (introducing raggedness vs. plain rows, or a uniform shift of
  *all* task icons) or moving the fold glyph (theme-fragile). This is why #2 is
  **not** a clean isolated fix and shares this doc with #3.

---

## 4. Root-cause measurements

Default Obsidian theme, `docs/demo-vault`, a task with a sub-bullet carrying the
`#appointment` signifier (calendar-clock). Viewport x-coordinates, px.

### 4.1 Reading view

| element | selector | x | width | notes |
|---|---|---|---|---|
| signifier | `.jf-signifier-gutter` | 301 | 16 | 301–317 |
| **fold toggle** | `.list-collapse-indicator` | 310 | 42 | box; glyph svg ~310–320 |
| checkbox (hidden) | `input.task-list-item-checkbox` | 329 | 16 | `position: relative` |
| status icon | `[data-jf-doc-icon]` | 337 | 16 | 337–353; clear of fold ✓ |

⇒ fold glyph (310–320) overlaps signifier (301–317). Status icon is clear.

### 4.2 Live preview

| element | selector | x | width | notes |
|---|---|---|---|---|
| signifier | `.jf-signifier-gutter.jf-signifier-live` | 285 | 26 | 285–311 |
| **fold glyph** (hover) | `.collapse-indicator` | 308 | 15 | right-aligned to ~323 |
| fold anchor | `.cm-fold-indicator` | 323 | 0 | zero-width, at text origin |
| status icon | `.task-list-label` | 319 | 22 | 319–341; same x on plain row |

⇒ fold glyph (308–323) overlaps signifier (308–311) **and** status icon (319–323).

### 4.3 Confirmed: neither overlap is a regression from commit `0dff3c9`

Toggling the shipped `.jf-doc-task-status { position: relative }` live and
re-measuring left the signifier, fold, and icon at **identical** coordinates
(reading view: sig 301 / fold 310 / icon 337 with the rule both on and off). The
`position: relative` change only altered paint/stacking order (so clicks reach
the icon); it moved nothing. Both overlaps are pre-existing gutter contention.

---

## 5. Options considered (and why rejected for the automatic path)

1. **Fold-aware measurement** — teach the positioners to treat the fold
   indicator's left edge as a row-start candidate so the signifier hangs left of
   it. *Rejected as the default* because: (a) in `margin-column`, `columnAnchorX`
   is a min across rows ⇒ one collapsible row shifts the **whole column** for
   everyone; (b) it adds DOM-measurement to the most delicate module; (c) it
   does nothing for the status-icon overlap; (d) it only knows about the fold
   toggle, not other obstacles.
2. **Hard-coded CSS nudge** of the fold glyph (or icon) — contradicts the
   "measure, never hard-code, because gutters are theme/font-dependent" principle.
   The user's theme renders the fold as a `+` (i.e. it *restyles* the control),
   so a value tuned to the default theme would not match.
3. **Z-index only** — make the signifier/icon paint over the faint fold glyph.
   Smallest blast radius, but does not *separate* them; the glyph edge still
   peeks. Does not satisfy "should not overlap".

These remain valid fallback notes; the chosen path (opt-in tunable offset)
subsumes #1's intent without its coupling, and avoids #2's fragility by letting
the user — who can see their own theme — set the magnitude.

---

## 6. Proposed design — opt-in tunable offset(s)

### 6.1 Principle

A new opt-in feature, **off by default**. When on, an additive offset shifts the
plugin's margin element(s) clear of the colliding glyph. Because the user tunes
it to their theme, we never hard-code knowledge of any specific obstacle.

### 6.2 Targets (three positioning systems, possibly distinct offsets)

| # | Target | Mode(s) | Where applied |
|---|---|---|---|
| T1 | signifier gutter | reading view | `gutter-positioner.ts` — add to computed `left` (and feed into reserve/clamp) |
| T2 | signifier gutter | live preview | `signifier-live-preview.ts` `measureGutterLefts()` — add to computed `left` |
| T3 | task status icon | live preview | `document-task-live-preview.ts` — left margin/padding on the icon widget |

Reading-view status icon needs **no** offset (it is already clear of the fold —
§4.1), so T3 is live-preview-only.

### 6.3 Settings (shape — see open questions §7)

Recommended starting shape (global-only, added to `GLOBAL_ONLY_FIELDS`):

```ts
// Opt-in: shift margin signifiers clear of a collapsible row's fold toggle.
// 0 = off (default; layout identical to today). Positive = further into the
// left margin (clears the reading-view fold toggle). Negative = toward the
// text. Unit: em (scales with font, like the icons).
signifierGutterOffsetEm: number   // default 0

// Opt-in: shift the live-preview task status icon clear of the fold toggle.
// 0 = off (default). Positive = right, toward the text. Unit: em.
taskIconGutterOffsetEm: number    // default 0
```

Each gets a settings-tab control (number input or slider) with help text that
states **purpose** and **consequence** explicitly, e.g.:

> **Signifier fold-toggle offset.** A list item with children shows a fold/
> collapse toggle that can overlap its margin signifier. Increase this to push
> signifiers further into the margin until they clear the toggle. **0 disables
> it (default).** In **Column** placement this shifts the whole signifier column
> and may reserve a little more left margin, nudging note content right.

### 6.4 Mechanics & invariants

- **Additive, after measurement.** The offset is added to the already-measured
  host-relative `left` (T1/T2) or applied as widget margin (T3). Off (`0`) ⇒ no
  code path change in result ⇒ regression-safe.
- **Reserve/clamp.** Fold the offset into `maxGutterReserve()` so a large
  positive (leftward) offset is not silently capped, and so `computeReserve()`
  still reserves enough lane that the shifted icon does not clip.
- **Column anchor.** With a uniform offset applied to every row, `margin-column`
  stays aligned (no raggedness) — a uniform shift is *better* here than the
  fold-aware approach.
- **Sign convention** must be documented and consistent across modes — note the
  reading-view fold wants the signifier **left**, while a hypothetical
  right-side obstacle wants it **right** (see §7).

---

## 7. Open design questions (resolve at implementation time)

1. **Signed vs unsigned offset?** Reading-view fold ⇒ push signifier *left*.
   Other obstacles could want *right*. Recommend **signed** (allow ±) for
   flexibility; default 0.
2. **One offset or per-mode?** Reading view and live preview have different
   gutter geometry. A single `signifierGutterOffsetEm` is simplest; separate
   reading/LP offsets are more precise. Recommend **start with one**, split only
   if testing shows one value can't serve both.
3. **Per-target?** Signifier (T1/T2) and status icon (T3) are different elements
   in different systems; a single scalar can't serve both. Recommend **two
   settings** (signifier offset, task-icon offset) as in §6.3.
4. **Units & default.** `em` (font-scaling, matches icon sizing) vs `px`
   (predictable). Recommend **em**. Default **0**. Document a suggested non-zero
   starting value in the help text (≈ `1.5em` clears a default-theme fold
   toggle), but ship the default at 0 (feature off).
5. **Control type.** Number input vs slider. A slider with live preview is
   friendlier for "dial until it clears"; a number input is simpler. Either.

---

## 8. Non-goals

- **Editor line numbers.** Obsidian's *Show line numbers* puts numbers in the
  CodeMirror gutter (`.cm-gutters`/`.cm-lineNumbers`) — live-preview only, a
  different element from the fold toggle. Deliberately **out of scope**: the
  collision direction conflicts with the fold case (numbers sit far-left, fold
  sits at the text origin), and in **`margin`** placement a single signifier
  offset cannot clear both at once. Not worth the added complexity.
- **Reading-view status icon offset.** Already clear of the fold (§4.1); no
  setting needed.
- **Moving Obsidian's fold glyph itself.** Theme-fragile (rejected option §5.2).

---

## 9. Test strategy (multi-level — required)

### 9.1 Unit (`tests/features/journal-signifiers/…`)

- Extend the pure-geometry tests for `gutter-positioner.ts`. Any new pure helper
  (e.g. `applyOffset(left, offsetPx)` or an offset-aware `maxGutterReserve`) gets
  direct cases, including **offset = 0 ⇒ identity** (the regression guard at unit
  level).
- Convert the em→px resolution (if `em`) into a pure, tested function.

### 9.2 E2E (`tests/e2e/specs/…`, see `tests/e2e/TEST-PLAN.md`)

Matrix — pick a representative cross-section that covers each dimension at least
once (full Cartesian is too slow):

- **Views:** reading view, live preview.
- **Placements:** `margin`, `margin-column`.
- **Line types:** task line, bullet line **with children** (collapsible, no
  task), ordered/numbered line, **plain paragraph** (no bullet/task — must prove
  the offset is inert: not collapsible, nothing to clear).
- **Setting:** off, on.

Core assertions:

- **off ⇒ invariance.** Signifier/icon viewport rects are **identical** to a
  captured baseline (the regression guard — this is the most important test).
- **on ⇒ separation.** On a collapsible row, the signifier rect no longer
  intersects the fold-control rect, and `elementFromPoint` over the signifier
  centre returns the signifier (mirrors the existing
  `task-nested-collapse`/`task-live-preview` `elementFromPoint` pattern).
- **on ⇒ status icon (LP).** `elementFromPoint` at the live-preview status-icon
  centre returns the icon, and the icon rect clears the fold glyph rect.

Reuse the harness fixture pattern: a committed note under
`tests/e2e/jf-e2e-vault/` with a collapsible `#appointment` task; drive settings
via `ctx.applySettings({...})`; assert with `ctx.inPage`/`elementFromPoint`.

---

## 10. Implementation checklist

1. Add setting keys + defaults to `journal-folder-settings.type.ts`; add to
   `GLOBAL_ONLY_FIELDS` in `folder-settings-resolver.ts`.
2. Settings-tab controls + help text in
   `journal-folder-settings/journal-folder-settings-tab.ts` (signifier section).
3. Thread the offset through `scheduleReadingGutters`/`positionReadingGutters`
   (T1) and `measureGutterLefts` (T2); fold into reserve/clamp.
4. Apply the task-icon offset in `document-task-live-preview.ts` (T3) — left
   margin on the icon widget, gated on the setting.
5. Unit tests (§9.1) incl. offset-0 identity.
6. E2E suite + fixture (§9.2); wire into `tests/e2e/specs/index.mjs`; document in
   `tests/e2e/TEST-PLAN.md`.
7. `CHANGELOG.md` `## [Unreleased]` entry.
8. Build + deploy to `docs/demo-vault` (and the user's vault if desired).

---

## 11. How to reproduce / re-measure (for whoever picks this up)

The numbers in §4 were taken live via the Obsidian CLI. To redo them:

- Obsidian must be **running** with the **`demo-vault`** open. The CLI
  `eval`/`dev:dom` commands need it; **run the CLI with the sandbox disabled**
  (the Obsidian CLI does not work from inside the command sandbox).
- Probe note (`docs/demo-vault/_sig-probe.md`):

  ```md
  # Probe

  - [ ] Discipleship #appointment
  	- The event sub bullet
  - [ ] Plain task no children
  ```

  (`#appointment` → calendar-clock signifier; the sub-bullet makes row 1
  collapsible.) After creating it on disk, wait ~2s for Obsidian to index before
  `obsidian vault=demo-vault open path=_sig-probe.md`.

- Switch modes via `setViewState` (`mode: 'preview'` = reading view;
  `mode: 'source', source: false` = live preview).
- Measure with an `eval` that reads `getBoundingClientRect()` of the elements in
  §4 and `document.elementFromPoint(cx, cy)` at an element's centre to hit-test
  stacking. **Remember to delete `_sig-probe.md` afterwards.**

---

## 12. Appendix — raw measurements

Reading view (rule on vs off — proves no-move): `sig 301 / fold 310 / icon 337`
both ways. Live preview: `sig 285–311`, `fold glyph 308–323` (anchor 323),
`status icon 319–341` (same x on the plain no-children row → icon position is
children-independent). See §4 for the full tables.
