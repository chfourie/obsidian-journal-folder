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
  import type { App } from 'obsidian'
  import type { JournalTask } from '../../data-access'
  import type { TaskModel } from './task-models'
  import TaskItem from './TaskItem.svelte'

  type Props = {
    tasks: JournalTask[]
    model: TaskModel
    checkboxStyle: 'square' | 'circle'
    app: App
    showCompleted: boolean
    hiddenCompletedCount: number
    totalBeforeCap: number
    header: 'sidebar' | 'note'
    referenceMode?: 'today' | 'dynamic'
    onToggleReference?: () => void
    onToggleShowCompleted?: () => void
    onOpenScopeMenu?: (evt: MouseEvent | KeyboardEvent) => void
    onOpenSettings?: () => void
  }

  const {
    tasks,
    model,
    checkboxStyle,
    app,
    showCompleted,
    hiddenCompletedCount,
    totalBeforeCap,
    header,
    referenceMode,
    onToggleReference,
    onToggleShowCompleted,
    onOpenScopeMenu,
    onOpenSettings,
  }: Props = $props()

  const headerLabel = $derived.by(() => {
    if (showCompleted) return `TASKS (${tasks.length})`
    return `TASKS (${tasks.length} · ${hiddenCompletedCount} ✓ hidden)`
  })

  const truncated = $derived(totalBeforeCap > tasks.length)

  function activate(handler?: () => void) {
    return (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && handler) {
        e.preventDefault()
        handler()
      }
    }
  }
</script>

<div class="journal-folder-tasks">
  <div class="journal-folder-tasks-header">
    <span class="journal-folder-tasks-header-label">{headerLabel}</span>
    <span class="journal-folder-tasks-header-controls">
      {#if header === 'sidebar' && onToggleReference}
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-pressed={referenceMode === 'today'}
          onclick={onToggleReference}
          onkeydown={activate(onToggleReference)}
        >
          {referenceMode === 'today' ? 'Dynamic' : 'Today'}
        </span>
        <span class="journal-folder-tasks-sep">·</span>
      {/if}
      {#if onToggleShowCompleted}
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-pressed={!showCompleted}
          onclick={onToggleShowCompleted}
          onkeydown={activate(onToggleShowCompleted)}
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </span>
      {/if}
      {#if header === 'sidebar' && onOpenScopeMenu}
        <span class="journal-folder-tasks-sep">·</span>
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-haspopup="menu"
          onclick={(e) => onOpenScopeMenu(e)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenScopeMenu(e)
            }
          }}
        >⋯</span>
      {/if}
    </span>
  </div>

  {#if tasks.length === 0}
    <p class="journal-folder-tasks-empty">No tasks in range.</p>
  {:else}
    <div class="journal-folder-tasks-list">
      {#each tasks as task (task.sourceFile.path + ':' + task.sourceLine)}
        <TaskItem
          task={task}
          model={model}
          checkboxStyle={checkboxStyle}
          app={app}
        />
      {/each}
    </div>
  {/if}

  {#if truncated}
    <div class="journal-folder-tasks-footer">
      Showing {tasks.length} of {totalBeforeCap} —
      {#if onOpenSettings}
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          onclick={onOpenSettings}
          onkeydown={activate(onOpenSettings)}
        >increase limit in settings</span>
      {:else}
        increase the limit in plugin settings
      {/if}
    </div>
  {/if}
</div>
