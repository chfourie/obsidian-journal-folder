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

import { type App, FuzzySuggestModal, type TFolder } from 'obsidian'

// Fuzzy folder picker for the *Initialize a new journal folder* action.
// The candidate list is provided by the caller — this class just renders
// it. Keeping the filtering out here means the picker can be opened
// against either a fresh `findInitialisableFolders(app)` result or, in the
// future, a curated subset (e.g. only top-level folders).
export class InitJournalFolderModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly candidates: TFolder[],
    private readonly onPick: (folder: TFolder) => void | Promise<void>
  ) {
    super(app)
    this.setPlaceholder(
      candidates.length === 0
        ? 'No eligible folders — every non-root folder is already a journal folder.'
        : 'Pick a folder to initialise as a journal folder…'
    )
  }

  getItems(): TFolder[] {
    return this.candidates
  }

  getItemText(folder: TFolder): string {
    return folder.path
  }

  onChooseItem(folder: TFolder): void {
    void this.onPick(folder)
  }
}
