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
import {
  colorRefToCss,
  type ShellAppearance,
  type TaskModel,
  type TaskStatus,
  type TaskStatusId,
} from './task-models'

// Stamps the given DOM element with the shell + icon visuals for a
// status. Used everywhere a status icon is painted outside Svelte
// (the reading-view post-processor and the live-preview decorator).
// The Svelte renderer (`StatusIcon.svelte`) calls into this same
// helper from a `$effect` so all surfaces stay byte-identical.
//
// Convention: the *outer* element is the shell (carries data
// attributes + the shape / fill / border). An inner `<span>` is
// created for the icon glyph so its inset and colour can be set
// independently of the shell. When `shell.shape === 'none'` we skip
// the frame styling but still apply the inner glyph + colour.
export function renderStatusIcon(
  el: HTMLElement,
  status: TaskStatus | undefined,
  model: TaskModel
): void {
  // Vanilla DOM removal so this helper works under jsdom (tests) and
  // outside markdown contexts where Obsidian's `el.empty()` /
  // `el.createSpan()` augmentations aren't available.
  while (el.firstChild) el.removeChild(el.firstChild)
  el.classList.add('jf-task-status')
  el.dataset.model = model.id
  if (!status) {
    el.removeAttribute('data-status')
    return
  }
  el.dataset.status = status.id
  el.dataset.task = status.char
  el.classList.toggle('is-done', status.isDone)
  applyShellStyles(el, status.shell)

  const iconWrapper = document.createElement('span')
  iconWrapper.classList.add('jf-task-status-icon')
  const color = colorRefToCss(status.icon.color)
  if (color) iconWrapper.style.color = color
  const inset = status.icon.inset ?? 0.7
  iconWrapper.style.width = `${Math.round(inset * 100)}%`
  iconWrapper.style.height = `${Math.round(inset * 100)}%`
  el.appendChild(iconWrapper)

  const src = status.icon.source
  if (src.kind === 'lucide') {
    setIcon(iconWrapper, src.name)
  } else if (src.kind === 'emoji') {
    iconWrapper.textContent = src.emoji
  } else if (src.kind === 'image') {
    const img = document.createElement('img')
    // `src` is set via the DOM property (not `innerHTML`) so the
    // value can't escape into markup — safe to take from settings.
    img.src = src.url
    img.alt = ''
    iconWrapper.appendChild(img)
  }
  // src.kind === 'none' leaves the wrapper empty — the shell stands
  // on its own (open ring, in-progress filled circle).
}

function applyShellStyles(el: HTMLElement, shell: ShellAppearance): void {
  // Reset any prior render's inline styles so a status change
  // (cycling open → done → open) doesn't accumulate stale rules.
  el.style.background = ''
  el.style.border = ''
  el.style.borderRadius = ''
  el.classList.remove(
    'jf-shell-none',
    'jf-shell-circle',
    'jf-shell-square',
    'jf-shell-rounded-square'
  )
  el.classList.add(`jf-shell-${shell.shape}`)
  if (shell.shape === 'none') return

  const bg = colorRefToCss(shell.background)
  el.style.background = bg ?? 'transparent'
  if (shell.border) {
    const borderColor = colorRefToCss(shell.border.color) ?? 'currentColor'
    el.style.border = `${shell.border.width}px solid ${borderColor}`
  } else {
    el.style.border = 'none'
  }
  if (shell.shape === 'circle') el.style.borderRadius = '50%'
  else if (shell.shape === 'rounded-square') el.style.borderRadius = '0.25em'
}

// Convenience for sites that have the model + status id (the common
// case): look up the status and call `renderStatusIcon`. Falls back
// to a safe empty render on unknown ids.
export function renderStatusIconById(
  el: HTMLElement,
  statusId: TaskStatusId,
  model: TaskModel
): void {
  const status = model.statuses.find((s) => s.id === statusId)
  renderStatusIcon(el, status, model)
}
