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

export type ConfirmOptions = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  // Styles the confirm button as a destructive (warning) action.
  destructive?: boolean
}

class ConfirmModal extends Modal {
  private settled = false

  constructor(
    app: App,
    private opts: ConfirmOptions,
    private resolver: (confirmed: boolean) => void
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, titleEl } = this
    titleEl.setText(this.opts.title)
    contentEl.createEl('p', { text: this.opts.message })

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' })

    const cancel = buttons.createEl('button', {
      text: this.opts.cancelText ?? 'Cancel',
    })
    cancel.addEventListener('click', () => {
      this.settle(false)
      this.close()
    })

    const confirm = buttons.createEl('button', {
      text: this.opts.confirmText ?? 'Confirm',
      cls: this.opts.destructive ? 'mod-warning' : 'mod-cta',
    })
    confirm.addEventListener('click', () => {
      this.settle(true)
      this.close()
    })
    confirm.focus()
  }

  onClose(): void {
    // Closing without an explicit choice (Esc, click outside) counts as cancel.
    this.settle(false)
    this.contentEl.empty()
  }

  private settle(confirmed: boolean): void {
    if (this.settled) return
    this.settled = true
    this.resolver(confirmed)
  }
}

// Opens a yes/no confirmation modal and resolves to the user's choice. Esc /
// click-outside resolve to `false`.
export function confirmModal(
  app: App,
  opts: ConfirmOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, opts, resolve).open()
  })
}
