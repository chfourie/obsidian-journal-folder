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
    rendering: 'plugin' | 'theme'
    onClick: (evt: MouseEvent) => void
    onContextMenu: (evt: MouseEvent) => void
  }

  const {
    status,
    model,
    checkboxStyle,
    rendering,
    onClick,
    onContextMenu,
  }: Props = $props()

  let iconEl: HTMLSpanElement | undefined = $state(undefined)

  const statusEntry = $derived(model.statuses.find((s) => s.id === status))
  const statusChar = $derived(statusEntry?.char ?? ' ')
  // Mirror Obsidian's own convention: the `<input>` is rendered
  // checked for every status whose char isn't a literal space.
  // Themes (AnuPpuccin et al.) hang their per-status `[data-task="X"]`
  // styling off `input[type=checkbox]:checked`, so an unchecked
  // input for, say, `[/]` would skip the theme rule entirely and
  // fall back to the default browser checkbox.
  const isChecked = $derived(statusChar !== ' ')
  const iconName = $derived.by(() => {
    if (!statusEntry) return checkboxStyle === 'circle' ? 'circle' : 'square'
    return checkboxStyle === 'circle'
      ? statusEntry.iconCircle
      : statusEntry.iconSquare
  })

  $effect(() => {
    if (rendering === 'plugin' && iconEl) {
      iconEl.empty()
      setIcon(iconEl, iconName)
    }
  })
</script>

{#if rendering === 'theme'}
  <!--
    Theme mode — render Obsidian's native checkbox markup so themes
    (Minimal, Things, AnuPpuccin, …) that target
    `input.task-list-item-checkbox[data-task="X"]` style it. The plugin
    still owns the cycle / context-menu by intercepting click +
    contextmenu and preventing the native toggle. `checked` is bound
    declaratively from `isDone` so re-renders after a cycle land back
    at the correct state.
  -->
  <input
    type="checkbox"
    class="task-list-item-checkbox"
    data-task={statusChar}
    checked={isChecked}
    aria-label={`Status: ${status}`}
    onclick={(e) => {
      e.preventDefault()
      onClick(e)
    }}
    oncontextmenu={(e) => {
      e.preventDefault()
      onContextMenu(e)
    }}
  />
{:else}
  <span
    bind:this={iconEl}
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
{/if}
