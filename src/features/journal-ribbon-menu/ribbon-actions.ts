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

import type {
  JournalFolderSettings,
  RibbonPlacementKey,
} from '../../data-access'
import type { SidebarMenuItem } from '../journal-folder-sidebar'

// One action the ribbon menu can host. Its `placementKey` setting decides
// whether it appears as a menu row (`'menu'`), as its own top-level ribbon
// icon (`'ribbon'`), or nowhere (`'off'`).
export type RibbonAction = {
  placementKey: RibbonPlacementKey
  title: string
  icon: string
  // A ribbon icon can't re-label itself per open the way a menu row does,
  // so state-dependent actions (the light/dark switch) give a stable variant.
  ribbonTitle?: string
  ribbonIcon?: string
  // Registered as a command so the action stays reachable on mobile (no
  // ribbon strip) whatever its placement. Omitted when another feature
  // already owns the command (Today's `open-today`).
  commandId?: string
  run: () => void
}

type PlacementSettings = Pick<JournalFolderSettings, RibbonPlacementKey>

// Groups render separated in the menu; a group whose actions all live
// elsewhere disappears along with its separator.
export function buildMenuItems(
  groups: ReadonlyArray<ReadonlyArray<RibbonAction>>,
  settings: PlacementSettings
): SidebarMenuItem[] {
  const visibleGroups = groups
    .map((group) =>
      group.filter((action) => settings[action.placementKey] === 'menu')
    )
    .filter((group) => group.length > 0)
  return visibleGroups.flatMap((group, i) => [
    ...(i > 0 ? [{ kind: 'separator' } as const] : []),
    ...group.map(
      (action): SidebarMenuItem => ({
        kind: 'item',
        title: action.title,
        icon: action.icon,
        onClick: action.run,
      })
    ),
  ])
}

type AddRibbonIcon = (
  icon: string,
  title: string,
  callback: () => void
) => HTMLElement

// The top-level ribbon icons for every action placed `'ribbon'`. Reconciled
// on each settings change: icons are added / removed individually, so an
// unchanged action keeps its position in the strip.
export class RibbonIconSet {
  readonly #icons = new Map<RibbonPlacementKey, HTMLElement>()

  constructor(private readonly addRibbonIcon: AddRibbonIcon) {}

  reconcile(
    actions: ReadonlyArray<RibbonAction>,
    settings: PlacementSettings
  ): void {
    for (const action of actions) {
      const wanted = settings[action.placementKey] === 'ribbon'
      const existing = this.#icons.get(action.placementKey)
      if (wanted && !existing) {
        this.#icons.set(
          action.placementKey,
          this.addRibbonIcon(
            action.ribbonIcon ?? action.icon,
            action.ribbonTitle ?? action.title,
            action.run
          )
        )
      } else if (!wanted && existing) {
        existing.remove()
        this.#icons.delete(action.placementKey)
      }
    }
  }

  clear(): void {
    this.#icons.forEach((icon) => icon.remove())
    this.#icons.clear()
  }
}
