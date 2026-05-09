/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export type JournalFolderSettings = {
  dailyNoteTitlePattern: string
  dailyNoteShortTitlePattern: string
  dailyNoteMediumTitlePattern: string
  weeklyNoteTitlePattern: string
  weeklyNoteShortTitlePattern: string
  weeklyNoteMediumTitlePattern: string
  monthlyNoteTitlePattern: string
  monthlyNoteShortTitlePattern: string
  monthlyNoteMediumTitlePattern: string
  quarterlyNoteTitlePattern: string
  quarterlyNoteShortTitlePattern: string
  quarterlyNoteMediumTitlePattern: string
  yearlyNoteTitlePattern: string
  yearlyNoteShortTitlePattern: string
  yearlyNoteMediumTitlePattern: string
  journalFolderTitle: string
  useFolderNameAsDefaultTitle: boolean
  defaultCalendarVisibleDesktop: boolean
  defaultCalendarVisibleMobile: boolean
  // Quarterly notes are off by default — turning them on activates the
  // YYYY-Q[1-4] file pattern and inserts quarters between year and month in
  // the higher/lower-order navigation. Folder-level override goes through
  // the front-matter key `quarters-enabled`.
  quartersEnabled: boolean
  // When enabled, newly created notes whose basename matches a journal file
  // pattern (daily/weekly/monthly/quarterly/yearly) and that live in a folder
  // containing a `journal-folder.md` config note are seeded with a template
  // body. Disable per-folder by setting `auto-template-enabled: false` in
  // that folder's `journal-folder.md` front matter. The template body itself
  // can be overridden globally via `autoTemplateContent` and per-folder by
  // putting markdown in the body of `journal-folder.md`.
  autoTemplateEnabled: boolean
  // Markdown used to seed new journal notes when auto-template is enabled
  // and no per-folder body override is present in `journal-folder.md`. When
  // empty, a built-in default (a single `journal-header` code block) is used.
  // Acts as the cross-tier fallback — the per-tier fields below take
  // precedence when the new note matches that tier.
  autoTemplateContent: string
  // When true, the auto-fill feature ignores `autoTemplateContent` and uses
  // the per-tier fields below instead — one template per note type. When
  // false (the default), the per-tier fields are ignored and every tier
  // shares `autoTemplateContent`. The two modes are mutually exclusive in
  // the UI (a single toggle in the settings tab swaps which fields show).
  autoTemplatePerTier: boolean
  // Per-tier templates used only when `autoTemplatePerTier` is true. An
  // empty string for a tier falls through to the built-in default. The
  // folder-level override (the body of `journal-folder.md`) still wins
  // over all of these.
  dailyNoteAutoTemplateContent: string
  weeklyNoteAutoTemplateContent: string
  monthlyNoteAutoTemplateContent: string
  quarterlyNoteAutoTemplateContent: string
  yearlyNoteAutoTemplateContent: string
  // Controls the first day of the week. `'locale-default'` leaves moment's
  // current locale untouched; the explicit weekday names override moment's
  // locale so both the calendar grid and `gggg-[W]ww` week numbering shift
  // accordingly. Applied globally — this overrides moment's locale for the
  // running Obsidian process, so folder-level overrides are intentionally
  // not honoured for this field.
  startOfWeek: StartOfWeekSetting
  // Folder path of the user's preferred journal folder. The sidebar opens
  // here on first load; the *Switch to default folder* action resets the
  // sidebar context to this value. Empty string means "no default chosen
  // yet" — the sidebar then falls back to the first detected journal
  // folder. **Global only** — this is a UI preference, not a per-folder
  // concept.
  defaultJournalFolder: string
  // When true, every `journal-folder.md` file is hidden from Obsidian's
  // built-in file explorer via a body-class-scoped CSS rule. The notes
  // still exist on disk and remain accessible via search, links, and the
  // sidebar's *Edit configuration* action — they just don't clutter the
  // tree. **Global only** because the file-explorer DOM is process-wide.
  hideJournalFolderNotes: boolean
  // Controls how the sidebar follows (or doesn't follow) the active leaf.
  // `'dynamic'` switches the sidebar's selected folder whenever the active
  // file is a recognised journal note in a journal folder, and scrolls the
  // calendar to that note's period. `'static'` ignores active-leaf changes
  // — the sidebar only moves when the user picks a folder explicitly.
  // **Global only** because the sidebar is a singleton view.
  sidebarMode: SidebarMode
}

export type SidebarMode = 'static' | 'dynamic'

export type StartOfWeekSetting =
  | 'locale-default'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export const DEFAULT_SETTINGS: JournalFolderSettings = {
  dailyNoteTitlePattern: 'dddd, DD MMMM YYYY',
  dailyNoteShortTitlePattern: 'ddd, D MMM',
  dailyNoteMediumTitlePattern: 'ddd, D MMM YY',
  weeklyNoteTitlePattern: 'gggg [Week] w',
  weeklyNoteShortTitlePattern: '[W]ww',
  weeklyNoteMediumTitlePattern: '[W]ww gg',
  monthlyNoteTitlePattern: 'MMMM YYYY',
  monthlyNoteShortTitlePattern: 'MMM',
  monthlyNoteMediumTitlePattern: 'MMM YY',
  quarterlyNoteTitlePattern: 'YYYY [Quarter] Q',
  quarterlyNoteShortTitlePattern: '[Q]Q',
  quarterlyNoteMediumTitlePattern: '[Q]Q YY',
  yearlyNoteTitlePattern: 'YYYY',
  yearlyNoteShortTitlePattern: 'YYYY',
  yearlyNoteMediumTitlePattern: 'YYYY',
  journalFolderTitle: '',
  useFolderNameAsDefaultTitle: false,
  defaultCalendarVisibleDesktop: true,
  defaultCalendarVisibleMobile: false,
  quartersEnabled: false,
  autoTemplateEnabled: false,
  autoTemplateContent: '',
  autoTemplatePerTier: false,
  dailyNoteAutoTemplateContent: '',
  weeklyNoteAutoTemplateContent: '',
  monthlyNoteAutoTemplateContent: '',
  quarterlyNoteAutoTemplateContent: '',
  yearlyNoteAutoTemplateContent: '',
  startOfWeek: 'locale-default',
  defaultJournalFolder: '',
  hideJournalFolderNotes: true,
  sidebarMode: 'dynamic',
}
