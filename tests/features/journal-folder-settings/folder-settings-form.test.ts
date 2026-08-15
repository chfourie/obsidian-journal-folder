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

import { describe, expect, it, vi } from 'vitest'
import { renderSettingsForm } from '../../../src/features/journal-folder-settings/folder-settings-form'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../../src/data-access'
import { App } from 'obsidian'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function setup(options: {
  folderOverrides?: Partial<JournalFolderSettings>
  overriddenFields?: string[]
  global?: Partial<JournalFolderSettings>
} = {}) {
  const global: JournalFolderSettings = {
    ...DEFAULT_SETTINGS,
    ...options.global,
  }
  let folder: JournalFolderSettings = {
    ...global,
    ...options.folderOverrides,
  }
  const overridden = new Set(options.overriddenFields ?? [])
  const saveSettings = vi.fn(async (next: JournalFolderSettings) => {
    folder = next
  })
  const containerEl = document.createElement('div')
  document.body.appendChild(containerEl)
  renderSettingsForm({
    app: new App(),
    containerEl,
    getCurrentSettings: () => folder,
    getGlobalSettings: () => global,
    getOverriddenFields: () => overridden,
    saveSettings,
  })
  return {
    containerEl,
    saveSettings,
    getFolder: () => folder,
  }
}

function select(containerEl: HTMLElement, hook: string): HTMLSelectElement {
  const el = containerEl.querySelector(`[data-jf-setting="${hook}"] select`)
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`No dropdown for hook "${hook}"`)
  }
  return el
}

function pick(el: HTMLSelectElement, value: string): void {
  el.value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function groupHeadings(containerEl: HTMLElement): string[] {
  return [
    ...containerEl.querySelectorAll(
      '.setting-group > .setting-item-heading .setting-item-name'
    ),
  ].map((el) => el.textContent ?? '')
}

function openPage(containerEl: HTMLElement, page: string): void {
  const link = containerEl.querySelector<HTMLElement>(
    `[data-jf-page-link="${page}"]`
  )
  if (!link) throw new Error(`No page link for "${page}"`)
  link.click()
}

describe('renderSettingsForm (folder mode)', () => {
  it('renders the root page like the global tab: groups plus navigable sub-pages', () => {
    const { containerEl } = setup()
    const headings = groupHeadings(containerEl)
    expect(headings).toEqual(
      expect.arrayContaining(['General', 'Today', 'Calendar'])
    )
    // Global-only sections stay out of the folder form.
    expect(headings).not.toContain('Sidebar')
    expect(headings).not.toContain('Reset')
    // The big sections sit behind navigable entries, as on the global tab.
    for (const page of ['templates', 'patterns', 'tasks']) {
      const link = containerEl.querySelector(`[data-jf-page-link="${page}"]`)
      expect(link, `page link "${page}"`).not.toBeNull()
      expect(link!.classList).toContain('mod-navigable')
      expect(link!.querySelector('.setting-item-chevron')).not.toBeNull()
    }
    // The old custom tab strip is gone.
    expect(containerEl.querySelector('[data-jf-settings-tab]')).toBeNull()
    expect(containerEl.getAttribute('data-jf-folder-page')).toBe('root')
  })

  it('drills into a sub-page and returns via the back header', () => {
    const { containerEl } = setup()
    expect(
      containerEl.querySelector('[data-jf-setting="dailyNoteTitlePattern-mode"]')
    ).toBeNull()
    openPage(containerEl, 'patterns')
    expect(containerEl.getAttribute('data-jf-folder-page')).toBe('patterns')
    expect(
      containerEl.querySelector('.setting-page-titlebar .setting-page-title')
        ?.textContent
    ).toBe('Note title patterns')
    expect(
      containerEl.querySelector('[data-jf-setting="dailyNoteTitlePattern-mode"]')
    ).not.toBeNull()
    containerEl
      .querySelector<HTMLElement>('[data-jf-page-back]')!
      .click()
    expect(containerEl.getAttribute('data-jf-folder-page')).toBe('root')
    expect(
      containerEl.querySelector('[data-jf-page-link="patterns"]')
    ).not.toBeNull()
  })

  it('defaults every override dropdown to the inherit choice', () => {
    const { containerEl } = setup()
    const dd = select(containerEl, 'quartersEnabled')
    expect(dd.value).toBe('__jf_default__')
    expect(dd.options[0].textContent).toContain('Default (')
  })

  it('persists a boolean override, coerced to a real boolean', async () => {
    const { containerEl, saveSettings, getFolder } = setup()
    pick(select(containerEl, 'quartersEnabled'), 'true')
    await flush()
    expect(saveSettings).toHaveBeenCalled()
    expect(getFolder().quartersEnabled).toBe(true)
  })

  it('restores the inherited value when Default is picked', async () => {
    const { containerEl, getFolder } = setup({
      folderOverrides: { includeInTodayPicker: false },
      overriddenFields: ['includeInTodayPicker'],
      global: { includeInTodayPicker: true },
    })
    const dd = select(containerEl, 'includeInTodayPicker')
    expect(dd.value).toBe('false')
    pick(dd, '__jf_default__')
    await flush()
    expect(getFolder().includeInTodayPicker).toBe(true)
  })

  it('reveals a custom input when a text override switches to Custom', async () => {
    const { containerEl, getFolder } = setup()
    openPage(containerEl, 'patterns')
    expect(
      containerEl.querySelector('[data-jf-setting="dailyNoteTitlePattern"]')
    ).toBeNull()
    pick(select(containerEl, 'dailyNoteTitlePattern-mode'), 'custom')
    await flush()
    const input = containerEl.querySelector<HTMLInputElement>(
      '[data-jf-setting="dailyNoteTitlePattern"] input'
    )
    expect(input).not.toBeNull()
    input!.value = 'DD MMM'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(getFolder().dailyNoteTitlePattern).toBe('DD MMM')
  })

  it('hides the quarterly patterns unless quarters are enabled', () => {
    const disabled = setup()
    openPage(disabled.containerEl, 'patterns')
    expect(
      disabled.containerEl.querySelector(
        '[data-jf-setting="quarterlyNoteTitlePattern-mode"]'
      )
    ).toBeNull()
    expect(groupHeadings(disabled.containerEl)).not.toContain('Quarterly notes')

    const enabled = setup({ folderOverrides: { quartersEnabled: true } })
    openPage(enabled.containerEl, 'patterns')
    expect(
      enabled.containerEl.querySelector(
        '[data-jf-setting="quarterlyNoteTitlePattern-mode"]'
      )
    ).not.toBeNull()
    expect(groupHeadings(enabled.containerEl)).toContain('Quarterly notes')
  })

  it('shows migration heading overrides only for heading placement', () => {
    const plain = setup()
    openPage(plain.containerEl, 'tasks')
    expect(
      plain.containerEl.querySelector(
        '[data-jf-setting="taskMigrationHeading-mode"]'
      )
    ).toBeNull()

    const heading = setup({
      folderOverrides: { taskMigrationPlacement: 'heading' },
    })
    openPage(heading.containerEl, 'tasks')
    expect(
      heading.containerEl.querySelector(
        '[data-jf-setting="taskMigrationHeading-mode"]'
      )
    ).not.toBeNull()
    expect(
      heading.containerEl.querySelector(
        '[data-jf-setting="taskMigrationHeadingLevel"]'
      )
    ).not.toBeNull()
  })

  it('keeps the user on their sub-page through a structural re-render', async () => {
    const { containerEl } = setup()
    openPage(containerEl, 'templates')
    pick(select(containerEl, 'autoTemplateEnabled'), 'false')
    await flush()
    expect(containerEl.getAttribute('data-jf-folder-page')).toBe('templates')
    expect(
      containerEl.querySelector('.setting-page-titlebar .setting-page-title')
        ?.textContent
    ).toBe('New-note template')
  })
})
