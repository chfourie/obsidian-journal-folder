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

import { type App, FuzzySuggestModal, type TFile } from 'obsidian'

// Fuzzy picker for the destination of a migration. The candidate list
// is resolved by the caller (`listJournalNotesInFolder`) and is always
// confined to a single journal folder — migration never crosses
// folders. Items are matched / displayed by basename (the date stamp),
// which is also the link text written onto the origin line.
export class MigrationTargetModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly candidates: TFile[],
    private readonly onPick: (file: TFile) => void
  ) {
    super(app)
    this.setPlaceholder(
      candidates.length === 0
        ? 'No other journal notes in this folder to migrate into.'
        : 'Pick the note to migrate the task(s) into…'
    )
  }

  getItems(): TFile[] {
    return this.candidates
  }

  getItemText(file: TFile): string {
    return file.basename
  }

  onChooseItem(file: TFile): void {
    this.onPick(file)
  }
}
