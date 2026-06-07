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

import { type App, Modal } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { JournalTask } from '../../data-access'
import type { TaskModel } from './task-models'
import MigrationTaskPicker from './MigrationTaskPicker.svelte'

// Modal wrapper around the grouped multi-select task picker. Used by
// both file-menu migration flows (from-note and to-note); the only
// difference is the candidate set and the heading the caller supplies.
// Borrows the settings-dialog `mod-settings` skin so the list lays out
// at a comfortable width rather than the default narrow modal.
export class MigrationPickerModal extends Modal {
  private component: ReturnType<typeof mount> | null = null

  constructor(
    app: App,
    private readonly options: {
      tasks: JournalTask[]
      model: TaskModel
      heading: string
      title: string
      onConfirm: (selected: JournalTask[]) => void
    }
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText(this.options.title)
    this.modalEl.addClass('mod-settings', 'journal-folder-migrate-modal-wrap')
    this.contentEl.addClass('journal-folder-migrate-modal')
    this.component = mount(MigrationTaskPicker, {
      target: this.contentEl,
      props: {
        tasks: this.options.tasks,
        model: this.options.model,
        heading: this.options.heading,
        onConfirm: (selected: JournalTask[]) => {
          this.options.onConfirm(selected)
          this.close()
        },
        onCancel: () => this.close(),
      },
    })
  }

  onClose(): void {
    if (this.component) {
      // noinspection JSIgnoredPromiseFromCall
      void unmount(this.component)
      this.component = null
    }
    this.contentEl.empty()
  }
}
