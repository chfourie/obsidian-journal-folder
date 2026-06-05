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

// One selectable entry in the migration action chooser — a label plus
// the flow to run when it's picked.
export interface MigrationAction {
  title: string
  run: () => void
}

// First-step picker for the unified "migrate tasks" command: the user
// chooses which migration flow to run (this line / from this note / to
// this note). The caller assembles the action list so only the flows
// that make sense in the current context are offered.
export class MigrationActionModal extends FuzzySuggestModal<MigrationAction> {
  constructor(
    app: App,
    private readonly actions: MigrationAction[]
  ) {
    super(app)
    this.setPlaceholder('Choose a task migration action…')
  }

  getItems(): MigrationAction[] {
    return this.actions
  }

  getItemText(action: MigrationAction): string {
    return action.title
  }

  onChooseItem(action: MigrationAction): void {
    action.run()
  }
}
