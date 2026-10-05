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
import {
  buildMenuItems,
  type RibbonAction,
  RibbonIconSet,
} from '../../../src/features/journal-ribbon-menu/ribbon-actions'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../../src/data-access'

function action(
  placementKey: RibbonAction['placementKey'],
  extra: Partial<RibbonAction> = {}
): RibbonAction {
  return { placementKey, title: placementKey, icon: 'icon', run: vi.fn(), ...extra }
}

const theme = action('colorSchemeButtonPlacement', {
  ribbonTitle: 'Switch light/dark mode',
  ribbonIcon: 'sun-moon',
})
const today = action('todayButtonPlacement')
const folder = action('folderSidebarButtonPlacement')
const tasks = action('tasksSidebarButtonPlacement')
const init = action('initFolderButtonPlacement')
const groups = [[theme], [today, folder, tasks], [init]]

function settings(
  overrides: Partial<JournalFolderSettings> = {}
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

function titles(items: ReturnType<typeof buildMenuItems>): string[] {
  return items.map((i) => (i.kind === 'item' ? i.title : '---'))
}

describe('buildMenuItems', () => {
  it('lists every action, groups separated, by default', () => {
    expect(titles(buildMenuItems(groups, settings()))).toEqual([
      'colorSchemeButtonPlacement',
      '---',
      'todayButtonPlacement',
      'folderSidebarButtonPlacement',
      'tasksSidebarButtonPlacement',
      '---',
      'initFolderButtonPlacement',
    ])
  })

  it('omits actions placed on the ribbon or turned off', () => {
    const items = buildMenuItems(
      groups,
      settings({
        todayButtonPlacement: 'ribbon',
        tasksSidebarButtonPlacement: 'off',
      })
    )
    expect(titles(items)).toEqual([
      'colorSchemeButtonPlacement',
      '---',
      'folderSidebarButtonPlacement',
      '---',
      'initFolderButtonPlacement',
    ])
  })

  it('drops an emptied group together with its separator', () => {
    const items = buildMenuItems(
      groups,
      settings({
        colorSchemeButtonPlacement: 'ribbon',
        initFolderButtonPlacement: 'off',
      })
    )
    expect(titles(items)).toEqual([
      'todayButtonPlacement',
      'folderSidebarButtonPlacement',
      'tasksSidebarButtonPlacement',
    ])
  })

  it('is empty when nothing is placed in the menu', () => {
    const allOff = settings({
      todayButtonPlacement: 'off',
      folderSidebarButtonPlacement: 'ribbon',
      tasksSidebarButtonPlacement: 'off',
      colorSchemeButtonPlacement: 'off',
      initFolderButtonPlacement: 'ribbon',
    })
    expect(buildMenuItems(groups, allOff)).toEqual([])
  })

  it('wires each row to its action', () => {
    const [first] = buildMenuItems([[today]], settings())
    expect(first.kind === 'item' && first.onClick).toBe(today.run)
  })
})

describe('RibbonIconSet', () => {
  function makeSet() {
    const added: { icon: string; title: string; el: HTMLElement }[] = []
    const addRibbonIcon = vi.fn((icon: string, title: string) => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      added.push({ icon, title, el })
      return el
    })
    return { set: new RibbonIconSet(addRibbonIcon), addRibbonIcon, added }
  }

  const actions = groups.flat()

  it('adds no icons while everything lives in the menu', () => {
    const { set, addRibbonIcon } = makeSet()
    set.reconcile(actions, settings())
    expect(addRibbonIcon).not.toHaveBeenCalled()
  })

  it('adds an icon for each action placed on the ribbon', () => {
    const { set, added } = makeSet()
    set.reconcile(
      actions,
      settings({
        folderSidebarButtonPlacement: 'ribbon',
        initFolderButtonPlacement: 'ribbon',
      })
    )
    expect(added.map((a) => a.title)).toEqual([
      'folderSidebarButtonPlacement',
      'initFolderButtonPlacement',
    ])
  })

  it('prefers the stable ribbon title and icon when given', () => {
    const { set, addRibbonIcon } = makeSet()
    set.reconcile(actions, settings({ colorSchemeButtonPlacement: 'ribbon' }))
    expect(addRibbonIcon).toHaveBeenCalledWith(
      'sun-moon',
      'Switch light/dark mode',
      theme.run
    )
  })

  it('keeps existing icons and removes ones moved off the ribbon', () => {
    const { set, addRibbonIcon, added } = makeSet()
    set.reconcile(
      actions,
      settings({
        todayButtonPlacement: 'ribbon',
        tasksSidebarButtonPlacement: 'ribbon',
      })
    )
    set.reconcile(
      actions,
      settings({
        todayButtonPlacement: 'ribbon',
        tasksSidebarButtonPlacement: 'menu',
      })
    )
    expect(addRibbonIcon).toHaveBeenCalledTimes(2)
    expect(added[0].el.isConnected).toBe(true)
    expect(added[1].el.isConnected).toBe(false)
  })

  it('re-adds an icon moved back onto the ribbon', () => {
    const { set, addRibbonIcon } = makeSet()
    set.reconcile(actions, settings({ todayButtonPlacement: 'ribbon' }))
    set.reconcile(actions, settings({ todayButtonPlacement: 'off' }))
    set.reconcile(actions, settings({ todayButtonPlacement: 'ribbon' }))
    expect(addRibbonIcon).toHaveBeenCalledTimes(2)
  })

  it('clear removes every icon', () => {
    const { set, added } = makeSet()
    set.reconcile(
      actions,
      settings({
        todayButtonPlacement: 'ribbon',
        colorSchemeButtonPlacement: 'ribbon',
      })
    )
    set.clear()
    expect(added.every((a) => !a.el.isConnected)).toBe(true)
  })
})
