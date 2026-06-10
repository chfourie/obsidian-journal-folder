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

import { type App, FuzzySuggestModal } from 'obsidian'

// Folder picker shown when the "Today" action resolves to more than one
// candidate journal folder. The caller supplies the resolved folder paths;
// picking one opens that folder's current-day note. Reusing Obsidian's
// fuzzy suggester keeps this keyboard- and mobile-friendly (no ribbon
// dependency), matching the *Initialise a new journal folder* picker.
export class TodayFolderPickerModal extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private readonly folders: string[],
    private readonly onPick: (folderPath: string) => void | Promise<void>
  ) {
    super(app)
    this.setPlaceholder("Pick a journal folder to open today's note…")
  }

  getItems(): string[] {
    return this.folders
  }

  getItemText(folderPath: string): string {
    // The root folder is reported as '/' by findJournalFolderPaths; show
    // something readable rather than a bare slash.
    return folderPath === '/' ? '(vault root)' : folderPath
  }

  onChooseItem(folderPath: string): void {
    void this.onPick(folderPath)
  }
}
