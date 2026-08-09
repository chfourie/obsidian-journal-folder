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

import { type App, ButtonComponent, getIconIds, Modal, setIcon } from 'obsidian'
import {
  COMMON_EMOJI,
  COMMON_LUCIDE_ICONS,
  type EmojiEntry,
} from './icon-picker-data'

const ICONS_PER_PAGE = 48

export type LucidePickerConfig = {
  containerEl: HTMLElement
  value: string
  onChange: (name: string) => void
}

// Renders Obsidian's full Lucide icon set with a search filter
// above the grid and First / Prev / Next / Last pagination
// controls below. Selecting an icon mirrors back into the custom
// text field so the user always sees the active name.
export function renderLucidePicker(config: LucidePickerConfig): void {
  const { containerEl, value, onChange } = config
  containerEl.empty()
  containerEl.addClass('jf-icon-picker')

  const allIcons = listAllLucideIcons()

  const searchEl = containerEl.createEl('input', {
    cls: 'jf-icon-search',
    attr: {
      type: 'search',
      placeholder: `Search ${allIcons.length} Lucide icons…`,
    },
  })

  const gridEl = containerEl.createDiv({ cls: 'jf-icon-grid' })
  const pager = createPagerControls(containerEl)
  const buttonByName = new Map<string, HTMLButtonElement>()

  let currentItems: string[] = []
  let page = 0

  const renderPage = (): void => {
    gridEl.empty()
    buttonByName.clear()
    const start = page * ICONS_PER_PAGE
    const slice = currentItems.slice(start, start + ICONS_PER_PAGE)
    for (const name of slice) {
      const btn = gridEl.createEl('button', { cls: 'jf-icon-cell' })
      btn.type = 'button'
      btn.title = name
      btn.setAttr('aria-label', name)
      const glyph = btn.createSpan({ cls: 'jf-icon-cell-glyph' })
      setIcon(glyph, name)
      btn.createSpan({ cls: 'jf-icon-cell-label', text: name })
      btn.onclick = (e) => {
        e.preventDefault()
        onChange(name)
        paintActive(buttonByName, name)
        customInput.value = name
      }
      buttonByName.set(name, btn)
    }
    pager.update({
      total: currentItems.length,
      pageSize: ICONS_PER_PAGE,
      page,
      itemNoun: 'icon',
      onSeek: (next) => {
        page = next
        renderPage()
      },
    })
    paintActive(buttonByName, value)
  }

  const applySearch = (filter: string): void => {
    const needle = filter.trim().toLowerCase()
    currentItems = needle
      ? allIcons.filter((name) => name.toLowerCase().includes(needle))
      : allIcons
    page = 0
    renderPage()
  }

  searchEl.oninput = () => applySearch(searchEl.value)

  const customRow = containerEl.createDiv({ cls: 'jf-icon-custom' })
  customRow.createSpan({
    cls: 'jf-icon-custom-label',
    text: 'Custom name',
  })
  const customInput = customRow.createEl('input', {
    cls: 'jf-icon-custom-text',
    attr: { type: 'text', placeholder: 'Lucide name…' },
  })
  customInput.value = value
  customInput.oninput = () => {
    const next = customInput.value.trim()
    onChange(next)
    paintActive(buttonByName, next)
  }

  applySearch('')
}

export type EmojiPickerConfig = {
  containerEl: HTMLElement
  value: string
  onChange: (emoji: string) => void
}

// Same layout as the Lucide picker: searchable, paged, with a
// custom-paste fallback. Keywords on each EmojiEntry drive the
// search filter.
export function renderEmojiPicker(config: EmojiPickerConfig): void {
  const { containerEl, value, onChange } = config
  containerEl.empty()
  containerEl.addClass('jf-icon-picker')

  const searchEl = containerEl.createEl('input', {
    cls: 'jf-icon-search',
    attr: {
      type: 'search',
      placeholder: `Search ${COMMON_EMOJI.length} emoji by keyword…`,
    },
  })

  const gridEl = containerEl.createDiv({ cls: 'jf-icon-grid' })
  const pager = createPagerControls(containerEl)
  const hintEl = containerEl.createDiv({ cls: 'jf-icon-footer' })
  hintEl.setText(
    'Paste any emoji into "Custom emoji" below — the system picker ' +
      '(⌃⌘Space on macOS, Win+. on Windows) covers everything not ' +
      'in this grid.'
  )

  const buttonByEmoji = new Map<string, HTMLButtonElement>()
  let currentItems: EmojiEntry[] = []
  let page = 0

  const renderPage = (): void => {
    gridEl.empty()
    buttonByEmoji.clear()
    const start = page * ICONS_PER_PAGE
    const slice = currentItems.slice(start, start + ICONS_PER_PAGE)
    for (const entry of slice) {
      const btn = gridEl.createEl('button', {
        cls: 'jf-icon-cell jf-icon-cell-emoji',
      })
      btn.type = 'button'
      btn.title = entry.keywords[0] ?? entry.emoji
      btn.setAttr('aria-label', entry.keywords[0] ?? entry.emoji)
      btn.createSpan({ cls: 'jf-icon-cell-glyph', text: entry.emoji })
      btn.onclick = (e) => {
        e.preventDefault()
        onChange(entry.emoji)
        paintActive(buttonByEmoji, entry.emoji)
        customInput.value = entry.emoji
      }
      buttonByEmoji.set(entry.emoji, btn)
    }
    pager.update({
      total: currentItems.length,
      pageSize: ICONS_PER_PAGE,
      page,
      itemNoun: 'emoji',
      onSeek: (next) => {
        page = next
        renderPage()
      },
    })
    paintActive(buttonByEmoji, value)
  }

  const applySearch = (filter: string): void => {
    const needle = filter.trim().toLowerCase()
    currentItems = needle
      ? COMMON_EMOJI.filter((entry) =>
          entry.keywords.some((k) => k.includes(needle))
        )
      : COMMON_EMOJI
    page = 0
    renderPage()
  }

  searchEl.oninput = () => applySearch(searchEl.value)

  const customRow = containerEl.createDiv({ cls: 'jf-icon-custom' })
  customRow.createSpan({
    cls: 'jf-icon-custom-label',
    text: 'Custom emoji',
  })
  const customInput = customRow.createEl('input', {
    cls: 'jf-icon-custom-text',
    attr: { type: 'text', placeholder: 'Paste an emoji…' },
  })
  customInput.value = value
  customInput.oninput = () => {
    const next = customInput.value
    onChange(next)
    paintActive(buttonByEmoji, next)
  }

  applySearch('')
}

// Modal wrapper around `renderEmojiPicker` — the searchable/paged grid
// plus a paste-any-emoji fallback, with Cancel / Use-emoji actions.
// Reused by the migration-reference settings so picking an emoji marker
// uses the same picker as the task-status icon editor. The grid updates
// a pending value; the choice only commits on "Use emoji".
export class EmojiPickerModal extends Modal {
  private pending: string

  constructor(
    app: App,
    private readonly current: string,
    private readonly onPick: (emoji: string) => void | Promise<void>
  ) {
    super(app)
    this.pending = current
  }

  onOpen(): void {
    this.titleEl.setText('Pick an emoji')
    const host = this.contentEl.createDiv()
    renderEmojiPicker({
      containerEl: host,
      value: this.current,
      onChange: (emoji) => {
        this.pending = emoji
      },
    })
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Use emoji')
      .setCta()
      .onClick(() => {
        void this.onPick(this.pending)
        this.close()
      })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

// Modal wrapper around `renderLucidePicker` — the full searchable Lucide
// grid plus a custom-name fallback, with Cancel / Use-icon actions.
// Returns the bare icon name (no `lucide:` prefix); the caller wraps it
// into the stored marker token.
export class LucidePickerModal extends Modal {
  private pending: string

  constructor(
    app: App,
    private readonly current: string,
    private readonly onPick: (name: string) => void | Promise<void>
  ) {
    super(app)
    this.pending = current
  }

  onOpen(): void {
    this.titleEl.setText('Pick a Lucide icon')
    const host = this.contentEl.createDiv()
    renderLucidePicker({
      containerEl: host,
      value: this.current,
      onChange: (name) => {
        this.pending = name
      },
    })
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Use icon')
      .setCta()
      .onClick(() => {
        if (this.pending.trim()) void this.onPick(this.pending.trim())
        this.close()
      })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

// ---- pager helper ----------------------------------------------

type PagerState = {
  total: number
  pageSize: number
  page: number
  itemNoun: string
  onSeek: (nextPage: number) => void
}

// Renders First / Prev / Next / Last controls and a "Showing
// X–Y of Z" label. Reused by both pickers. The buttons toggle
// disabled state based on the current page, and seeking is
// clamped so the UI never lands on an out-of-range page.
function createPagerControls(parent: HTMLElement): {
  update: (state: PagerState) => void
} {
  const wrap = parent.createDiv({ cls: 'jf-icon-pager' })
  const firstBtn = wrap.createEl('button', { cls: 'jf-icon-pager-btn' })
  firstBtn.type = 'button'
  firstBtn.setText('«')
  firstBtn.title = 'First page'

  const prevBtn = wrap.createEl('button', { cls: 'jf-icon-pager-btn' })
  prevBtn.type = 'button'
  prevBtn.setText('‹')
  prevBtn.title = 'Previous page'

  const labelEl = wrap.createSpan({ cls: 'jf-icon-pager-label' })

  const nextBtn = wrap.createEl('button', { cls: 'jf-icon-pager-btn' })
  nextBtn.type = 'button'
  nextBtn.setText('›')
  nextBtn.title = 'Next page'

  const lastBtn = wrap.createEl('button', { cls: 'jf-icon-pager-btn' })
  lastBtn.type = 'button'
  lastBtn.setText('»')
  lastBtn.title = 'Last page'

  return {
    update: (state) => {
      const totalPages = Math.max(
        1,
        Math.ceil(state.total / state.pageSize)
      )
      const page = Math.min(Math.max(0, state.page), totalPages - 1)
      const start = state.total === 0 ? 0 : page * state.pageSize + 1
      const end = Math.min(state.total, (page + 1) * state.pageSize)

      labelEl.setText(
        state.total === 0
          ? `No matching ${state.itemNoun}s`
          : `${start}–${end} of ${state.total} ${state.itemNoun}${
              state.total === 1 ? '' : 's'
            } · page ${page + 1} of ${totalPages}`
      )

      firstBtn.disabled = page === 0
      prevBtn.disabled = page === 0
      nextBtn.disabled = page >= totalPages - 1
      lastBtn.disabled = page >= totalPages - 1

      firstBtn.onclick = (e) => {
        e.preventDefault()
        if (page !== 0) state.onSeek(0)
      }
      prevBtn.onclick = (e) => {
        e.preventDefault()
        if (page > 0) state.onSeek(page - 1)
      }
      nextBtn.onclick = (e) => {
        e.preventDefault()
        if (page < totalPages - 1) state.onSeek(page + 1)
      }
      lastBtn.onclick = (e) => {
        e.preventDefault()
        if (page !== totalPages - 1) state.onSeek(totalPages - 1)
      }
    },
  }
}

// ---- helpers ---------------------------------------------------

let cachedLucideIcons: string[] | null = null

// Pulls the full Lucide set from Obsidian's icon registry once.
// `getIconIds()` returns every registered id (Lucide + plugin /
// theme additions); we strip the `lucide-` prefix that `setIcon`
// accepts both with and without.
function listAllLucideIcons(): string[] {
  if (cachedLucideIcons) return cachedLucideIcons
  try {
    const ids = getIconIds()
    const lucide = ids
      .filter((id) => id.startsWith('lucide-'))
      .map((id) => id.slice('lucide-'.length))
      .sort()
    cachedLucideIcons = lucide.length > 0 ? lucide : COMMON_LUCIDE_ICONS
  } catch {
    cachedLucideIcons = COMMON_LUCIDE_ICONS
  }
  return cachedLucideIcons
}

function paintActive(
  buttonByKey: Map<string, HTMLButtonElement>,
  active: string
): void {
  buttonByKey.forEach((btn) => btn.removeClass('is-active'))
  buttonByKey.get(active)?.addClass('is-active')
}
