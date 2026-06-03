<!--
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
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import type {
    TaskModel,
    TaskStatusId,
  } from './task-models'

  type Props = {
    status: TaskStatusId
    model: TaskModel
    checkboxStyle: 'square' | 'circle'
    onClick: (evt: MouseEvent) => void
    onContextMenu: (evt: MouseEvent) => void
  }

  const { status, model, checkboxStyle, onClick, onContextMenu }: Props =
    $props()

  let el: HTMLSpanElement | undefined = $state(undefined)

  const iconName = $derived.by(() => {
    const entry = model.statuses.find((s) => s.id === status)
    if (!entry) return checkboxStyle === 'circle' ? 'circle' : 'square'
    return checkboxStyle === 'circle' ? entry.iconCircle : entry.iconSquare
  })

  $effect(() => {
    if (el) {
      el.empty()
      setIcon(el, iconName)
    }
  })
</script>

<span
  bind:this={el}
  role="button"
  tabindex="0"
  class="journal-folder-tasks-status-icon"
  aria-label={`Status: ${status}`}
  onclick={onClick}
  oncontextmenu={(e) => {
    e.preventDefault()
    onContextMenu(e)
  }}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(e as unknown as MouseEvent)
    }
  }}
></span>
