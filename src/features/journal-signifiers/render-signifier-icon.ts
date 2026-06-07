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

import { setIcon } from 'obsidian'
import { colorRefToCss, type IconSpec } from '../../data-access'
import { sanitizeSvg } from '../../data-access/sanitize-svg'

// Renders a signifier / category `IconSpec` as an *inline* icon into `el`
// (no shell — unlike task status icons). Mirrors the icon half of
// `renderStatusIcon` so all surfaces paint identically: Lucide via
// `setIcon`, emoji as a text node, image via the DOM `src` property, SVG
// through the allow-list sanitiser. `lucide` / monochrome `svg` honour
// `icon.color` (locked explicitly so theme link/`.is-unresolved` styling
// can't recolour it); emoji and colour images ignore it.
//
// Vanilla DOM only (no Obsidian `el.empty()` helpers) so it works under
// jsdom in tests and inside CodeMirror widgets.
export function renderSignifierIcon(el: HTMLElement, icon: IconSpec): void {
  while (el.firstChild) el.removeChild(el.firstChild)
  el.classList.add('jf-signifier-icon')
  const color = colorRefToCss(icon.color)
  if (color) el.style.color = color
  else el.style.removeProperty('color')

  const src = icon.source
  if (src.kind === 'lucide') {
    setIcon(el, src.name)
  } else if (src.kind === 'emoji') {
    el.textContent = src.emoji
  } else if (src.kind === 'image') {
    const img = activeDocument.createElement('img')
    img.src = src.url
    img.alt = ''
    el.appendChild(img)
  } else if (src.kind === 'svg') {
    const cleaned = sanitizeSvg(src.markup)
    if (cleaned) {
      const imported = activeDocument.importNode(cleaned, true)
      imported.removeAttribute('width')
      imported.removeAttribute('height')
      imported.setAttribute('width', '100%')
      imported.setAttribute('height', '100%')
      el.appendChild(imported)
    }
  }
  // src.kind === 'none' leaves an empty span — nothing to draw.
}
