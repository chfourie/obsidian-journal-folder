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
  import type {
    TaskModel,
    TaskStatusId,
  } from './task-models'
  import { renderStatusIconById } from './render-status-icon'

  type Props = {
    status: TaskStatusId
    model: TaskModel
    onClick: (evt: MouseEvent) => void
    onContextMenu: (evt: MouseEvent) => void
  }

  const {
    status,
    model,
    onClick,
    onContextMenu,
  }: Props = $props()

  const statusEntry = $derived(model.statuses.find((s) => s.id === status))
  const statusChar = $derived(statusEntry?.char ?? ' ')
  // Rendering is a per-status property as of v3; the global setting
  // is gone. Default to 'plugin' for legacy entries without the
  // field (migration also stamps `rendering` so this is a belt-and-
  // braces fallback).
  const rendering = $derived(statusEntry?.rendering ?? 'plugin')
  // Mirror Obsidian's own convention: the `<input>` is rendered
  // checked for every status whose char isn't a literal space.
  // Themes (AnuPpuccin et al.) hang their per-status `[data-task="X"]`
  // styling off `input[type=checkbox]:checked`, so an unchecked
  // input for, say, `[/]` would skip the theme rule entirely.
  const isChecked = $derived(statusChar !== ' ')

  let pluginShellEl: HTMLSpanElement | undefined = $state(undefined)

  $effect(() => {
    if (rendering === 'plugin' && pluginShellEl) {
      renderStatusIconById(pluginShellEl, status, model)
    }
  })
</script>

{#if rendering === 'theme'}
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
    bind:this={pluginShellEl}
    role="button"
    tabindex="0"
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
