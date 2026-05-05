# Journal note model

`src/data-access/journal-note.ts` is the heart of the date logic. `journalNoteFactoryWithSettings(settings)` returns a factory that, given a `TFile`, picks one of up to five `JournalNoteStrategy` records (daily/weekly/monthly/quarterly/yearly) by regex-matching the basename. Each strategy carries:

- `fileRegex` — validates the basename
- `filePattern` — moment.js pattern used for filenames (fixed; not user-configurable)
- `titlePattern` / `shortTitlePattern` / `mediumTitlePattern` — user-configurable display patterns. *Medium* is used when a link points to a note in a different year than the source.
- `timeUnit` — `JournalTimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year'`

`JournalNote` exposes navigation methods (`forwardInTime`, `backInTime`, `closestSibling`, `getHigherOrderNotes`, `getLowerOrderNotes`, `getNotesInPeriod(unit)`, `dailyNoteToday`) plus state predicates (`isPresentTime`, `isPast`, `isExistingNote`, `isToday`) and `getTimeUnit()` / `hasUnit(unit)`. Higher-order notes (year/quarter/month/week containing the current note) and lower-order notes (e.g. months within a year) feed the More popover in the header. **All date math goes through `obsidian`'s re-exported `moment`** — do not import moment directly.

For weekly note patterns, only `gg`/`gggg` reflect the year correctly (the filename uses `gggg-[W]ww`). Using `YYYY`/`GG` in title patterns will desync the displayed year from the filename.

## Quarterly notes (opt-in)

Quarterly notes are gated by `settings.quartersEnabled` and use the filename pattern `YYYY-Q[1-4]` (moment format `YYYY-[Q]Q`). When enabled, `QUARTERLY_NOTE_STRATEGY` is inserted into `BY_DESCENDING_ORDER` between yearly and monthly so quarter files are recognised by the strategy detector and quarters appear naturally in `getHigherOrderNotes()` for daily/weekly/monthly notes. When disabled, the strategy is still present in the strategies map (so `noteFor('quarter', m)` still works for callers that opt in explicitly) but absent from the descending-order chain — quarter files won't be detected as journal notes and quarters won't show up in the higher/lower-order traversals.

The folder/embedded-config string `"true"`/`"false"` is honored via the same `isTruthySetting` convention used for `defaultCalendarVisible*` (only the literal lowercase `"false"` is falsy on the string path).

### Special case: yearly's lower-order

`getLowerOrderStrategy()` skips the quarterly tier when called on a yearly note so the primary lower-order list stays as 12 months (the most useful navigation surface from a year). The four quarters are surfaced separately via `getNotesInPeriod('quarter')`, which the header info layer wires into a dedicated `extraLinks` section. Other tiers don't need this skip — quarterly's lower-order is months (3), monthly's is weeks, etc.

### `getNotesInPeriod(unit)`

A generalised helper that returns the notes for `unit` falling within the current note's interval. Returns `[]` when the unit isn't active in `BY_DESCENDING_ORDER`, or when it's the same tier as the current note, or higher than the current tier. Used by the header to expose the Quarter section on yearly notes; `getLowerOrderNotes()` is a thin wrapper over the same iteration.
