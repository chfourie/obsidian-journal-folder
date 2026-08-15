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

// Structural view of `ButtonComponent`: `setDestructive` is optional because
// it only exists at runtime on Obsidian 1.13.0+, while our `minAppVersion`
// floor is 1.7.2.
interface DestructiveStylable {
  buttonEl: HTMLElement
  setDestructive?(): unknown
}

// Styles a button as destructive without calling the deprecated
// `setWarning()`: `setDestructive()` where the running Obsidian has it,
// otherwise the `mod-warning` class it would have added — the styling
// pre-1.13 themes actually ship.
export function styleAsDestructive<T extends DestructiveStylable>(
  button: T
): T {
  if (button.setDestructive) button.setDestructive()
  else button.buttonEl.addClass('mod-warning')
  return button
}
