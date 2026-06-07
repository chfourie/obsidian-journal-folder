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

import type { App } from 'obsidian'

// Obsidian's runtime `App` carries a `setting` controller (open the settings
// dialog, focus a specific plugin's tab) that isn't part of the public
// TypeScript surface. Narrowing it through one typed shape here keeps the
// `any`-cast in a single place instead of scattering `@ts-ignore` across every
// "Open settings" affordance.
interface SettingControllerApp extends App {
  setting?: {
    open?: () => void
    openTabById?: (id: string) => void
  }
}

// Opens the Obsidian settings dialog and focuses this plugin's tab. Both calls
// are optional-chained: the controller and its methods are runtime internals,
// so a future Obsidian could drop them without breaking the plugin.
export function openPluginSettings(app: App, pluginId: string): void {
  const controller = (app as SettingControllerApp).setting
  controller?.open?.()
  controller?.openTabById?.(pluginId)
}
