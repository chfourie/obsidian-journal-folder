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

import type { Plugin } from 'obsidian'
import { mount, unmount } from 'svelte'
import { PluginFeature } from '../../data-access'
import type { SidebarMenuItem } from '../journal-folder-sidebar'
import {
  colorSchemeMenuIcon,
  colorSchemeMenuLabel,
  nextColorScheme,
} from './theme-toggle'
import RibbonMenuPanel from './RibbonMenuPanel.svelte'

type RibbonMenuApi = {
  toggle: (anchor?: HTMLElement | null) => void
  close: () => void
}

// The other features own the actual surfaces; this feature is a thin aggregator
// that only needs a way to trigger each one. Injected from the plugin so the
// menu never reaches across features directly.
export type RibbonMenuActions = {
  openFolderSidebar: () => void | Promise<void>
  openTasksSidebar: () => void | Promise<void>
  initNewJournalFolder: () => void | Promise<void>
  openToday: () => void | Promise<void>
}

// The plugin's single "home" ribbon icon. Replaces the per-sidebar ribbon icons
// with one icon that opens a styled action menu (the two sidebar opens, the
// light/dark switch, and folder initialisation). Also registers an equivalent
// command so the menu is reachable on mobile, where Obsidian has no ribbon.
export class JournalRibbonMenuFeature extends PluginFeature {
  #api: RibbonMenuApi | null = null
  #host: HTMLElement | null = null
  #component: ReturnType<typeof mount> | null = null
  #ribbonEl: HTMLElement | null = null

  constructor(
    plugin: Plugin,
    private readonly actions: RibbonMenuActions
  ) {
    super(plugin)
  }

  async load(): Promise<void> {
    // The panel lives in a detached host and portals itself to <body>; it is
    // driven imperatively through the registered api.
    const host = activeWindow.createDiv()
    this.#host = host
    this.#component = mount(RibbonMenuPanel, {
      target: host,
      props: {
        getItems: () => this.#buildItems(),
        registerApi: (api: RibbonMenuApi) => {
          this.#api = api
        },
      },
    })

    this.#ribbonEl = this.plugin.addRibbonIcon(
      'notebook-text',
      'Journal Folder menu',
      () => this.#api?.toggle(this.#ribbonEl)
    )

    this.plugin.addCommand({
      id: 'open-journal-menu',
      name: 'Open menu',
      // No anchor → the panel opens centred (mobile / palette has no ribbon).
      callback: () => this.#api?.toggle(null),
    })
  }

  unload(): void {
    this.#api?.close()
    if (this.#component) {
      try {
        void unmount(this.#component)
      } catch {
        // Svelte can throw on unmount during teardown once the host has been
        // detached — safe to ignore (mirrors the sidebar view's handling).
      }
      this.#component = null
    }
    this.#host?.remove()
    this.#host = null
    this.#api = null
    this.#ribbonEl = null
  }

  // Resolved lazily on every open so the theme row reflects the current scheme.
  #buildItems(): SidebarMenuItem[] {
    const current = this.#currentColorScheme()
    const items: SidebarMenuItem[] = [
      {
        kind: 'item',
        title: colorSchemeMenuLabel(current),
        icon: colorSchemeMenuIcon(current),
        onClick: () => this.#toggleColorScheme(),
      },
      { kind: 'separator' },
    ]
    // The Today action lives here only when the user routes it to the menu;
    // `'ribbon'` gives it a dedicated icon and `'off'` hides it entirely
    // (both owned by the today feature). It leads so the most-frequent
    // action is first.
    if (this.globalSettings.todayButtonPlacement === 'menu') {
      items.push({
        kind: 'item',
        title: "Open today's journal note",
        icon: 'calendar-check',
        onClick: () => void this.actions.openToday(),
      })
    }
    items.push(
      {
        kind: 'item',
        title: 'Open Journal Folder sidebar',
        icon: 'calendar-days',
        onClick: () => void this.actions.openFolderSidebar(),
      },
      {
        kind: 'item',
        title: 'Open Journal Tasks sidebar',
        icon: 'list-checks',
        onClick: () => void this.actions.openTasksSidebar(),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        title: 'Initialise a new journal folder',
        icon: 'folder-plus',
        onClick: () => void this.actions.initNewJournalFolder(),
      }
    )
    return items
  }

  // `getTheme` / `changeTheme` are runtime-only methods on the App object,
  // absent from Obsidian's public TypeScript surface. They drive the standard
  // Base color scheme setting (Settings → Appearance), so the switch persists
  // and behaves identically to flipping it there. `getTheme()` resolves the
  // 'system' setting to the effective scheme.
  #currentColorScheme(): string {
    return this.#themeApi().getTheme?.() ?? 'obsidian'
  }

  #toggleColorScheme(): void {
    const api = this.#themeApi()
    const current = api.getTheme?.() ?? 'obsidian'
    api.changeTheme?.(nextColorScheme(current))
  }

  #themeApi(): {
    getTheme?: () => string
    changeTheme?: (value: string) => void
  } {
    return this.plugin.app as unknown as {
      getTheme?: () => string
      changeTheme?: (value: string) => void
    }
  }
}
