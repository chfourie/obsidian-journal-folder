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

import { type App, ButtonComponent, Modal, Setting } from 'obsidian'
import {
  type IconSpec,
  type JournalFolderSettings,
  type Signifier,
  type SignifierPlacement,
  type TaskCategory,
} from '../../data-access'
import { renderSignifierIcon } from '../journal-signifiers'
import { renderColorPicker } from './color-picker'
import { EmojiPickerModal, LucidePickerModal } from './icon-pickers'

// =============================================================
// Signifiers section
// =============================================================

export type SignifierSectionConfig = {
  app: App
  containerEl: HTMLElement
  getSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
  rerender: () => void
}

export function renderSignifiersSection(config: SignifierSectionConfig): void {
  const { app, containerEl, getSettings, saveSettings, rerender } = config
  const settings = getSettings()

  new Setting(containerEl)
    .setName('Signifiers')
    .setHeading()
    .setDesc(
      'Bind an icon to a tag (e.g. #important → ★). Signifiers render in ' +
        'reading view, live preview, and the plugin’s task lists, anywhere ' +
        'the tag appears.'
    )
    .addButton((btn) =>
      btn
        .setButtonText('Add signifier')
        .setCta()
        .onClick(async () => {
          const signifier: Signifier = {
            id: uniqueId('signifier', usedIds(settings.signifiers)),
            label: 'New signifier',
            tags: [],
            icon: {
              source: { kind: 'lucide', name: 'star' },
              color: { kind: 'token', var: '--color-yellow' },
            },
          }
          await saveSettings({
            ...settings,
            signifiers: [...settings.signifiers, signifier],
          })
          new SignifierEditModal(app, signifier, async (next) => {
            const cur = getSettings()
            await saveSettings({
              ...cur,
              signifiers: cur.signifiers.map((s) =>
                s.id === next.id ? next : s
              ),
            })
            rerender()
          }).open()
        })
    )

  new Setting(containerEl)
    .setName('Hide tag in reading view')
    .setDesc(
      'On — reading view shows only the signifier icon. Off — it shows ' +
        'the icon and the tag. (The plugin’s task lists always hide the tag.)'
    )
    .addToggle((toggle) =>
      toggle
        .setValue(settings.signifierHideTagInReadingView)
        .onChange(async (value) => {
          await saveSettings({
            ...getSettings(),
            signifierHideTagInReadingView: value,
          })
        })
    )

  new Setting(containerEl)
    .setName('Hide tag in live preview')
    .setDesc(
      'On — live preview shows only the signifier icon (the tag reappears ' +
        'while the cursor is on it, so it stays editable). Off — the tag stays ' +
        'visible.'
    )
    .addToggle((toggle) =>
      toggle
        .setValue(settings.signifierHideTagInLivePreview)
        .onChange(async (value) => {
          await saveSettings({
            ...getSettings(),
            signifierHideTagInLivePreview: value,
          })
        })
    )

  new Setting(containerEl)
    .setName('Reveal tags on the active line')
    .setDesc(
      'When hiding tags in live preview: on — putting the cursor anywhere on ' +
        'a line shows all of that line’s tags; off — only the tag the cursor ' +
        'touches is shown. No effect when tags aren’t hidden.'
    )
    .addToggle((toggle) =>
      toggle
        .setValue(settings.signifierShowTagsOnActiveLine)
        .onChange(async (value) => {
          await saveSettings({
            ...getSettings(),
            signifierShowTagsOnActiveLine: value,
          })
        })
    )

  new Setting(containerEl)
    .setName('Placement in notes')
    .setDesc(
      'Both options hang the icon in the left margin, positioned by ' +
        'measurement so they hold up across themes and snippets. The plugin’s ' +
        'own task lists always render inline.'
    )
    .addDropdown((dd) => {
      dd.addOption('margin', 'Per entry — indents with nesting')
      dd.addOption('margin-column', 'Single column — all icons far-left')
      dd.setValue(settings.signifierPlacement).onChange(async (value) => {
        await saveSettings({
          ...getSettings(),
          signifierPlacement: value as SignifierPlacement,
        })
      })
    })

  new Setting(containerEl)
    .setName('Reserve left margin for gutter signifiers')
    .setDesc(
      'Indent the note content just enough that the icons never clip when ' +
        'readable line width is off or the view is narrow. On by default.'
    )
    .addToggle((toggle) =>
      toggle
        .setValue(settings.signifierReserveGutter)
        .onChange(async (value) => {
          await saveSettings({
            ...getSettings(),
            signifierReserveGutter: value,
          })
        })
    )

  const listEl = containerEl.createDiv({ cls: 'jf-signifier-list' })
  settings.signifiers.forEach((signifier, index) => {
    const setting = new Setting(listEl)
      .setName(signifier.label || signifier.id)
      .setDesc(
        signifier.tags.length
          ? signifier.tags.map((t) => `#${t}`).join(' ')
          : '(no tags — won’t match anything)'
      )
    const icon = document.createElement('span')
    icon.className = 'jf-signifier'
    renderSignifierIcon(icon, signifier.icon)
    setting.nameEl.prepend(icon)

    addReorderButtons(setting, index, settings.signifiers.length, async (next) => {
      const cur = getSettings()
      await saveSettings({ ...cur, signifiers: move(cur.signifiers, index, next) })
      rerender()
    })
    setting.addExtraButton((btn) =>
      btn
        .setIcon('pencil')
        .setTooltip('Edit')
        .onClick(() => {
          new SignifierEditModal(app, signifier, async (nextSig) => {
            const cur = getSettings()
            await saveSettings({
              ...cur,
              signifiers: cur.signifiers.map((s) =>
                s.id === nextSig.id ? nextSig : s
              ),
            })
            rerender()
          }).open()
        })
    )
    setting.addExtraButton((btn) =>
      btn
        .setIcon('trash')
        .setTooltip('Remove')
        .onClick(async () => {
          const cur = getSettings()
          await saveSettings({
            ...cur,
            signifiers: cur.signifiers.filter((s) => s.id !== signifier.id),
          })
          rerender()
        })
    )
  })
}

// =============================================================
// Categories section
// =============================================================

export type CategorySectionConfig = SignifierSectionConfig

export function renderCategoriesSection(config: CategorySectionConfig): void {
  const { app, containerEl, getSettings, saveSettings, rerender } = config
  const settings = getSettings()

  new Setting(containerEl)
    .setName('Task categories')
    .setHeading()
    .setDesc(
      'Group tasks by tag at the top of every task list. Tasks matching a ' +
        'category’s tags are listed under it. Reorder with the arrows — the ' +
        'order here is the section order.'
    )
    .addButton((btn) =>
      btn
        .setButtonText('Add category')
        .setCta()
        .onClick(async () => {
          const category: TaskCategory = {
            id: uniqueId('category', usedIds(settings.taskCategories)),
            label: 'New category',
            tags: [],
          }
          await saveSettings({
            ...settings,
            taskCategories: [...settings.taskCategories, category],
          })
          new CategoryEditModal(app, category, async (next) => {
            const cur = getSettings()
            await saveSettings({
              ...cur,
              taskCategories: cur.taskCategories.map((c) =>
                c.id === next.id ? next : c
              ),
            })
            rerender()
          }).open()
        })
    )

  new Setting(containerEl)
    .setName('Also show categorized tasks under their note')
    .setDesc(
      'On — a categorized task appears both under its category and in its ' +
        'note group. Off — only under its category. Uncategorized tasks ' +
        'always appear under their note.'
    )
    .addToggle((toggle) =>
      toggle
        .setValue(settings.taskCategoryShowUnderNote)
        .onChange(async (value) => {
          await saveSettings({
            ...getSettings(),
            taskCategoryShowUnderNote: value,
          })
        })
    )

  const listEl = containerEl.createDiv({ cls: 'jf-signifier-list' })
  settings.taskCategories.forEach((category, index) => {
    const setting = new Setting(listEl)
      .setName(category.label || category.id)
      .setDesc(
        category.tags.length
          ? category.tags.map((t) => `#${t}`).join(' ')
          : '(no tags — won’t match anything)'
      )
    if (category.icon) {
      const icon = document.createElement('span')
      icon.className = 'jf-signifier'
      renderSignifierIcon(icon, category.icon)
      setting.nameEl.prepend(icon)
    }

    addReorderButtons(
      setting,
      index,
      settings.taskCategories.length,
      async (next) => {
        const cur = getSettings()
        await saveSettings({
          ...cur,
          taskCategories: move(cur.taskCategories, index, next),
        })
        rerender()
      }
    )
    setting.addExtraButton((btn) =>
      btn
        .setIcon('pencil')
        .setTooltip('Edit')
        .onClick(() => {
          new CategoryEditModal(app, category, async (nextCat) => {
            const cur = getSettings()
            await saveSettings({
              ...cur,
              taskCategories: cur.taskCategories.map((c) =>
                c.id === nextCat.id ? nextCat : c
              ),
            })
            rerender()
          }).open()
        })
    )
    setting.addExtraButton((btn) =>
      btn
        .setIcon('trash')
        .setTooltip('Remove')
        .onClick(async () => {
          const cur = getSettings()
          await saveSettings({
            ...cur,
            taskCategories: cur.taskCategories.filter(
              (c) => c.id !== category.id
            ),
          })
          rerender()
        })
    )
  })
}

// =============================================================
// Shared helpers
// =============================================================

function usedIds(items: ReadonlyArray<{ id: string }>): Set<string> {
  return new Set(items.map((i) => i.id))
}

function uniqueId(prefix: string, taken: Set<string>): string {
  for (let i = 1; i < 1000; i++) {
    const candidate = `${prefix}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${prefix}-${taken.size + 1}`
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// Adds ▲ / ▼ reorder buttons to a Setting row. `onMove` receives the
// destination index.
function addReorderButtons(
  setting: Setting,
  index: number,
  count: number,
  onMove: (next: number) => Promise<void>
): void {
  setting.addExtraButton((btn) =>
    btn
      .setIcon('chevron-up')
      .setTooltip('Move up')
      .setDisabled(index === 0)
      .onClick(() => void onMove(index - 1))
  )
  setting.addExtraButton((btn) =>
    btn
      .setIcon('chevron-down')
      .setTooltip('Move down')
      .setDisabled(index === count - 1)
      .onClick(() => void onMove(index + 1))
  )
}

// Parses a free-text tag input into bare, lowercased tag names. Accepts
// space- or comma-separated values, with or without leading `#`.
function parseTags(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    .filter((t) => t.length > 0)
}

// Renders the shared icon editor (type dropdown + preview + chooser +
// optional colour picker) into `host`, mutating `working.icon` in place
// and calling `onChange` after every edit.
function renderIconEditor(
  app: App,
  host: HTMLElement,
  getIcon: () => IconSpec,
  setIconSpec: (icon: IconSpec) => void,
  allowNone: boolean
): void {
  host.empty()

  const preview = document.createElement('span')
  preview.className = 'jf-signifier'
  const repaint = () => renderSignifierIcon(preview, getIcon())
  repaint()

  const typeSetting = new Setting(host).setName('Icon')
  typeSetting.controlEl.prepend(preview)
  typeSetting.addDropdown((dd) => {
    if (allowNone) dd.addOption('none', 'None')
    dd.addOption('lucide', 'Lucide icon')
    dd.addOption('emoji', 'Emoji')
    dd.setValue(getIcon().source.kind)
    dd.onChange((value) => {
      const cur = getIcon()
      if (value === 'lucide') {
        setIconSpec({
          source: { kind: 'lucide', name: 'star' },
          color: cur.color ?? { kind: 'token', var: '--color-yellow' },
        })
      } else if (value === 'emoji') {
        setIconSpec({ source: { kind: 'emoji', emoji: '⭐' } })
      } else {
        setIconSpec({ source: { kind: 'none' } })
      }
      renderIconEditor(app, host, getIcon, setIconSpec, allowNone)
    })
  })

  const source = getIcon().source
  if (source.kind === 'lucide') {
    typeSetting.addButton((btn) =>
      btn.setButtonText('Choose icon…').onClick(() => {
        new LucidePickerModal(app, source.name, (name) => {
          setIconSpec({ ...getIcon(), source: { kind: 'lucide', name } })
          repaint()
        }).open()
      })
    )
    const colorHost = host.createDiv()
    renderColorPicker({
      containerEl: colorHost,
      label: 'Icon colour',
      value: getIcon().color,
      compact: true,
      onChange: (next) => {
        setIconSpec({ ...getIcon(), color: next })
        repaint()
      },
    })
  } else if (source.kind === 'emoji') {
    typeSetting.addButton((btn) =>
      btn.setButtonText('Choose emoji…').onClick(() => {
        new EmojiPickerModal(app, source.emoji, (emoji) => {
          setIconSpec({ source: { kind: 'emoji', emoji } })
          repaint()
        }).open()
      })
    )
  }
}

// =============================================================
// Edit modals
// =============================================================

class SignifierEditModal extends Modal {
  private readonly working: Signifier

  constructor(
    app: App,
    signifier: Signifier,
    private readonly onSave: (next: Signifier) => Promise<void>
  ) {
    super(app)
    this.working = { ...signifier, tags: [...signifier.tags] }
  }

  onOpen(): void {
    this.titleEl.setText('Edit signifier')
    const { contentEl } = this

    new Setting(contentEl).setName('Label').addText((text) =>
      text.setValue(this.working.label).onChange((value) => {
        this.working.label = value
      })
    )
    new Setting(contentEl)
      .setName('Tags')
      .setDesc('Space- or comma-separated. The first tag is the one the ' +
        '“Modify signifiers on line” command inserts.')
      .addText((text) =>
        text
          .setPlaceholder('important priority')
          .setValue(this.working.tags.map((t) => `#${t}`).join(' '))
          .onChange((value) => {
            this.working.tags = parseTags(value)
          })
      )

    const iconHost = contentEl.createDiv()
    renderIconEditor(
      this.app,
      iconHost,
      () => this.working.icon,
      (icon) => {
        this.working.icon = icon
      },
      false
    )

    renderModalButtons(contentEl, () => this.close(), async () => {
      await this.onSave(this.working)
      this.close()
    })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

class CategoryEditModal extends Modal {
  private readonly working: TaskCategory

  constructor(
    app: App,
    category: TaskCategory,
    private readonly onSave: (next: TaskCategory) => Promise<void>
  ) {
    super(app)
    this.working = { ...category, tags: [...category.tags] }
  }

  onOpen(): void {
    this.titleEl.setText('Edit category')
    const { contentEl } = this

    new Setting(contentEl).setName('Label').addText((text) =>
      text.setValue(this.working.label).onChange((value) => {
        this.working.label = value
      })
    )
    new Setting(contentEl)
      .setName('Tags')
      .setDesc('Space- or comma-separated. Tasks with any of these tags ' +
        'are listed under this category.')
      .addText((text) =>
        text
          .setPlaceholder('important urgent')
          .setValue(this.working.tags.map((t) => `#${t}`).join(' '))
          .onChange((value) => {
            this.working.tags = parseTags(value)
          })
      )

    const iconHost = contentEl.createDiv()
    renderIconEditor(
      this.app,
      iconHost,
      () => this.working.icon ?? { source: { kind: 'none' } },
      (icon) => {
        this.working.icon = icon.source.kind === 'none' ? undefined : icon
      },
      true
    )

    renderModalButtons(contentEl, () => this.close(), async () => {
      await this.onSave(this.working)
      this.close()
    })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

function renderModalButtons(
  contentEl: HTMLElement,
  onCancel: () => void,
  onSave: () => void | Promise<void>
): void {
  const buttons = contentEl.createDiv({ cls: 'modal-button-container' })
  new ButtonComponent(buttons).setButtonText('Cancel').onClick(onCancel)
  new ButtonComponent(buttons)
    .setButtonText('Save')
    .setCta()
    .onClick(async () => {
      await onSave()
    })
}
