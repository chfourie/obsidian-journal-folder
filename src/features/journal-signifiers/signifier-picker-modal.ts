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

import { App, Modal, Setting } from 'obsidian'
import { type Signifier, extractTags, matchSignifiers } from '../../data-access'
import { renderSignifierIcon } from './render-signifier-icon'

// Multi-select modal listing every configured signifier, pre-checked with
// the ones already present on the line. On Apply it reports the selected
// ids back to the caller, which recomputes the line via
// `computeSignifierLineEdit`. Nothing is written until Apply.
export class SignifierPickerModal extends Modal {
  private readonly selected: Set<string>

  constructor(
    app: App,
    private readonly signifiers: readonly Signifier[],
    line: string,
    private readonly onApply: (selectedIds: string[]) => void
  ) {
    super(app)
    this.selected = new Set(
      matchSignifiers(extractTags(line), signifiers).map((s) => s.id)
    )
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h3', { text: 'Signifiers on this line' })

    for (const signifier of this.signifiers) {
      const setting = new Setting(contentEl)
        .setName(signifier.label)
        .setDesc(signifier.tags.map((t) => `#${t}`).join(' '))
      const icon = activeWindow.createSpan()
      icon.className = 'jf-signifier'
      renderSignifierIcon(icon, signifier.icon)
      setting.nameEl.prepend(icon)
      setting.addToggle((toggle) =>
        toggle
          .setValue(this.selected.has(signifier.id))
          .onChange((value) => {
            if (value) this.selected.add(signifier.id)
            else this.selected.delete(signifier.id)
          })
      )
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Apply')
          .setCta()
          .onClick(() => {
            this.onApply([...this.selected])
            this.close()
          })
      )
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => this.close())
      )
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
