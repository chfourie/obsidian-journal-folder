# use case: render a migration reference in reading view

Status: **RATIFIED 2026-07-06.** Drafted with the owner via the ratify method primer against the
repo's least-tested boundary — `processMigrationReferences` carried zero direct test coverage
before this session; its sibling pure helper `matchTrailingMarker` was already well tested
separately. Every scenario ruled as matching intent; no defects found, nothing banked as a
ratified-demand.
Checks: `render-migration-references.spec.ts`, colocated.
Level: **sea** · Kite goal: **a rendered migration reference never hides or mislabels the link a
task was actually migrated to/from**
Actor: whichever user is viewing a rendered journal note whose task lines carry a migration
reference
Trigger: Obsidian's reading-view renderer calls the plugin's registered markdown post-processor
whenever a block containing task lines is (re-)rendered — a system trigger, fired as a byproduct
of the user viewing, opening, or scrolling a note, never a direct user command of its own.

Scope: the seam between Obsidian's already-rendered reading-view DOM (a live `HTMLElement` handed
to the registered post-processor) and the plugin's own settings object — both plain function
arguments, no injected capability handle. What produced the DOM (Obsidian's own markdown renderer)
and what the user does with the note afterward are both out of scope. Popout-window-correct node
creation via the ambient `activeDocument` global is out of scope for checking (see `assumed, not
verified` below) — this function does not open, close, or track windows itself.

## capabilities

- none injected — the boundary reaches only the `HTMLElement` and `JournalFolderSettings` object
  it is called with, plus the ambient `activeDocument` global for popout-window-correct node
  creation (declared `assumed` below, not a capability on the framework's short recognized list).

## requires

- R1 `settings.taskMigrationReferenceOpacity` may be any number the settings store returns — no
  upstream validation guarantees it already lies in `[0, 100]`

## invariants

- I1 [proven] a link with no configured marker trailing its immediately preceding text is left
  completely unmodified — no wrapper span, no DOM mutation at all, same node identity

## ensures

- E1 [proven] when at least one of `taskMigrationToMarker`/`taskMigrationFromMarker` is configured
  (non-blank) and a link's immediately preceding text node ends with that marker as a standalone
  token, the marker and link are wrapped in one `.jf-migration-ref` span carrying
  `--jf-migration-ref-opacity` clamped to `[0, 100]`, with the marker rendered as a `lucide:`-named
  icon span or, for a non-`lucide:` marker, a plain text node
- E2 [proven] when both markers are configured blank, the function is a complete no-op — no link
  in `el` is inspected or mutated
- E3 [proven] a marker glued to non-whitespace (not a standalone token at the end of the preceding
  text) is never treated as a migration reference

## failures (the use case's extensions)

- F1 none — `processMigrationReferences` has no failure channel; a link it cannot safely wrap (no
  preceding text node, no parent node) is silently left alone, never thrown

## assumed, not verified

Per the primer's rule 4: where this boundary's correctness rides on Obsidian's own popout-window
plumbing rather than anything this check can observe under jsdom, the primitive is named and the
claim is taken on faith, rather than stretching a checkable tag over it.

- **`activeDocument`/`activeWindow` resolve to the correct window when a journal note is open in a
  popped-out Obsidian window** — the same honesty pattern as every other `activeDocument` call
  site already carried elsewhere in this plugin, all of which take the popout-correct global on
  faith rather than re-deriving it. Only costs a migration reference rendering into the main
  window's DOM instead of the popout's, never an incorrect task status or lost data.

## examples (scenario instances — the ratification surface)

1. A task line's label ends with the configured `→` marker directly followed by an internal link
   to the migration's destination note; in reading view, the marker and link are wrapped in one
   dimmed, hoverable span, and clicking the link still navigates normally (E1).
2. Neither `taskMigrationToMarker` nor `taskMigrationFromMarker` is configured (both blank);
   reading view renders the note exactly as Obsidian's default renderer produced it — no reference
   styling appears anywhere, even where a bare `→` happens to precede a link (E2).
3. `taskMigrationReferenceOpacity` is configured as `150` (a value outside the documented 0–100
   range, e.g. surviving from a hand-edited data file); the reference still renders, dimmed at the
   clamped maximum, rather than crashing or rendering at a nonsensical opacity (E1, R1).
4. A task line's label ends with a bare `→` glued directly to the preceding word with no
   whitespace (e.g. `…plannedwork→` immediately before the link); the arrow is left as ordinary
   label text and the link is never wrapped (E3).
5. A task line carries a `lucide:redo-2` token configured as the "to" marker, directly before a
   migration link; the marker renders as a small icon — never the literal text `lucide:redo-2` —
   inside the dimmed wrapper (E1).
6. An ordinary internal link elsewhere in the same task line, with no marker anywhere near it, is
   left completely untouched by this feature — same DOM node, unaffected (I1).

## unspecified (declared gaps)

- U1 a migration marker that lands inside its own inline markup immediately before the link (e.g.
  `**→**[[Note]]`, bold-wrapped) is not detected — the previous-sibling check requires a plain
  text node, and nested markup breaks the match. Known, undemonstrated priority; deferred rather
  than silently claimed as covered.

## Concern inventory

| # | Concern | Classification |
|---|---|---|
| 1 | No-op when both markers are blank | contract — E2 |
| 2 | Works with only one marker configured | contract — E1 |
| 3 | Opacity clamps to `[0, 100]` even given an out-of-range stored value | contract — E1, R1 |
| 4 | Longer marker strings win over shorter ones that could be a suffix match | routed — realized inside `matchTrailingMarker`, already unit-tested there; this contract exercises it end-to-end via E1's `lucide:` scenario |
| 5 | A link with no preceding sibling at all is left untouched | routed — same "no match" path as I1; not given its own numbered example since it degenerates to I1's shape |
| 6 | A link whose preceding sibling isn't a text node (marker hidden inside nested inline markup) is never detected | gap-or-non-promise — U1 |
| 7 | An ordinary internal link with no trailing marker is completely unaffected | contract — I1 |
| 8 | A marker not at a standalone token boundary is not treated as a migration reference | contract — E3 |
| 9 | Multiple links in one element are evaluated independently, no cross-contamination | routed — a consequence of E1/I1/E3 each holding per-link; not given its own numbered example |
| 10 | `activeDocument`/`activeWindow` popout-window correctness | assumed |
| 11 | Output-opacity question (primer rule 3): the output here is DOM structure — inspectable via jsdom assertions (classList, style, textContent), not opaque bytes like a rendered image — predicting a lower escape band than a truly opaque-output boundary | finding — informs the fraction-band discussion, not a clause |
| 12 | This contract's own concern inventory, written before its clauses | finding — self-assessed complete |
