# Journal note model

`src/data-access/journal-note.ts` is the heart of the date logic. `journalNoteFactoryWithSettings(settings)` returns a factory that, given a `TFile`, picks one of four `JournalNoteStrategy` records (daily/weekly/monthly/yearly) by regex-matching the basename. Each strategy carries:

- `fileRegex` — validates the basename
- `filePattern` — moment.js pattern used for filenames (fixed; not user-configurable)
- `titlePattern` / `shortTitlePattern` / `mediumTitlePattern` — user-configurable display patterns. *Medium* is used when a link points to a note in a different year than the source.
- `timeUnit` — `'day' | 'week' | 'month' | 'year'`

`JournalNote` exposes navigation methods (`forwardInTime`, `backInTime`, `closestSibling`, `getHigherOrderNotes`, `getLowerOrderNotes`, `dailyNoteToday`) plus state predicates (`isPresentTime`, `isPast`, `isExistingNote`, `isToday`) and `getTimeUnit()`. Higher-order notes (year/month/week containing the current note) and lower-order notes (e.g. months within a year) feed the More popover in the header. **All date math goes through `obsidian`'s re-exported `moment`** — do not import moment directly.

For weekly note patterns, only `gg`/`gggg` reflect the year correctly (the filename uses `gggg-[W]ww`). Using `YYYY`/`GG` in title patterns will desync the displayed year from the filename.
