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

import { App, Modal } from 'obsidian'

class ConfirmCreateModal extends Modal {
  private settled = false

  constructor(
    app: App,
    private message: string,
    private resolver: (confirmed: boolean) => void
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, titleEl } = this
    titleEl.setText('Create missing note?')
    contentEl.createEl('p', { text: this.message })

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' })

    const cancel = buttons.createEl('button', { text: 'Cancel' })
    cancel.addEventListener('click', () => {
      this.settle(false)
      this.close()
    })

    const create = buttons.createEl('button', {
      text: 'Create',
      cls: 'mod-cta',
    })
    create.addEventListener('click', () => {
      this.settle(true)
      this.close()
    })
    create.focus()
  }

  onClose(): void {
    // Closing without explicit choice (Esc, click outside) counts as cancel.
    this.settle(false)
    this.contentEl.empty()
  }

  private settle(confirmed: boolean): void {
    if (this.settled) return
    this.settled = true
    this.resolver(confirmed)
  }
}

export function confirmCreateNote(
  app: App,
  basename: string
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmCreateModal(
      app,
      `"${basename}" is in the past and has no note yet. Create one?`,
      resolve
    ).open()
  })
}
