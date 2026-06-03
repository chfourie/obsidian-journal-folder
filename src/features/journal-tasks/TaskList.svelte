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
<script module lang="ts">
  import { SvelteSet } from 'svelte/reactivity'

  // Module-level set so a user's collapse choices survive both
  // sidebar re-renders (driven by `setTaskPanelSnapshot`) and
  // in-note block remounts (driven by every vault mutation). Keyed
  // by source-note path so the same note collapses in lockstep
  // across both surfaces — usually what the user expects.
  // `SvelteSet` is the reactive variant from `svelte/reactivity`,
  // so reading from it inside `$derived` auto-tracks.
  const collapsedNotePaths = new SvelteSet<string>()
</script>

<script lang="ts">
  import type { App } from 'obsidian'
  import type { JournalTask } from '../../data-access'
  import type { TaskModel } from './task-models'
  import TaskItem from './TaskItem.svelte'

  type Props = {
    tasks: JournalTask[]
    model: TaskModel
    checkboxStyle: 'square' | 'circle'
    rendering: 'plugin' | 'theme'
    app: App
    showCompleted: boolean
    hiddenCompletedCount: number
    totalBeforeCap: number
    header: 'sidebar' | 'note'
    caption?: string
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
    rendering,
    app,
    showCompleted,
    hiddenCompletedCount,
    totalBeforeCap,
    header,
    caption,
    referenceMode,
    onToggleReference,
    onToggleShowCompleted,
    onOpenScopeMenu,
    onOpenSettings,
  }: Props = $props()

  const captionText = $derived(caption && caption.trim() ? caption : 'TASKS')
  const headerLabel = $derived.by(() => {
    if (showCompleted) return `${captionText} (${tasks.length})`
    return `${captionText} (${tasks.length} · ${hiddenCompletedCount} ✓ hidden)`
  })

  const truncated = $derived(totalBeforeCap > tasks.length)

  // The scope menu only narrows the `Today` reference — it has no effect
  // in Dynamic mode (which always follows the active note's folder), so
  // we hide the link entirely there to avoid suggesting otherwise.
  const showScopeLink = $derived(
    header === 'sidebar' &&
      !!onOpenScopeMenu &&
      referenceMode === 'today'
  )

  function activate(handler?: () => void) {
    return (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && handler) {
        e.preventDefault()
        handler()
      }
    }
  }

  // Group consecutive tasks that share a source note. The upstream
  // sort already places same-file tasks adjacent (tier → folder →
  // line), so a single linear pass is all we need. Heading text is
  // the parsed note's `getTitle()` (e.g. `Wednesday, 03 June 2026`),
  // which is more readable than the short chip used to be.
  type TaskGroup = {
    path: string
    title: string
    tasks: JournalTask[]
  }
  const groups = $derived.by(() => {
    const out: TaskGroup[] = []
    for (const task of tasks) {
      const last = out[out.length - 1]
      if (last && last.path === task.sourceFile.path) {
        last.tasks.push(task)
      } else {
        out.push({
          path: task.sourceFile.path,
          title: task.noteTitle,
          tasks: [task],
        })
      }
    }
    return out
  })

  function openGroupNote(path: string) {
    app.workspace.openLinkText(path, '', false)
  }

  function isCollapsed(path: string): boolean {
    return collapsedNotePaths.has(path)
  }

  function toggleCollapsed(path: string) {
    if (collapsedNotePaths.has(path)) collapsedNotePaths.delete(path)
    else collapsedNotePaths.add(path)
  }

  // Plain click on a heading toggles the group; cmd/ctrl-click jumps
  // to the source note instead (a fast way out when every task in
  // the group is already collapsed).
  function onHeadingClick(path: string, evt: MouseEvent) {
    if (evt.metaKey || evt.ctrlKey) {
      openGroupNote(path)
    } else {
      toggleCollapsed(path)
    }
  }
</script>

<div class="journal-folder-tasks">
  <div class="journal-folder-tasks-header">
    <span class="journal-folder-tasks-header-label">{headerLabel}</span>
  </div>
  {#if header === 'sidebar' || onToggleShowCompleted}
    <div class="journal-folder-tasks-controls">
      {#if header === 'sidebar' && onToggleReference}
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-pressed={referenceMode === 'today'}
          onclick={onToggleReference}
          onkeydown={activate(onToggleReference)}
        >
          {referenceMode === 'today' ? 'Today' : 'Dynamic'}
        </span>
        <span class="journal-folder-tasks-sep">·</span>
      {/if}
      {#if onToggleShowCompleted}
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-pressed={showCompleted}
          onclick={onToggleShowCompleted}
          onkeydown={activate(onToggleShowCompleted)}
        >
          {showCompleted ? 'All tasks' : 'Active tasks'}
        </span>
      {/if}
      {#if showScopeLink}
        <span class="journal-folder-tasks-sep">·</span>
        <span
          role="button"
          tabindex="0"
          class="journal-folder-tasks-link"
          aria-haspopup="menu"
          onclick={(e) => onOpenScopeMenu!(e)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenScopeMenu!(e)
            }
          }}
        >Folders</span>
      {/if}
    </div>
  {/if}

  {#if tasks.length === 0}
    <p class="journal-folder-tasks-empty">No tasks in range.</p>
  {:else}
    {#each groups as group (group.path)}
      {@const collapsed = isCollapsed(group.path)}
      <div
        class="journal-folder-tasks-group"
        class:is-collapsed={collapsed}
      >
        <div
          class="journal-folder-tasks-group-heading"
          role="button"
          tabindex="0"
          aria-expanded={!collapsed}
          title={`Click to collapse / expand. ${
            navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
          }-click to open the note.`}
          onclick={(e) => onHeadingClick(group.path, e)}
          onkeydown={activate(() => toggleCollapsed(group.path))}
        >
          <span
            class="journal-folder-tasks-group-caret"
            aria-hidden="true"
          >{collapsed ? '▸' : '▾'}</span>
          <span class="journal-folder-tasks-group-title">{group.title}</span>
          {#if collapsed}
            <span class="journal-folder-tasks-group-count">
              ({group.tasks.length})
            </span>
          {/if}
        </div>
        {#if !collapsed}
          <div
            class="journal-folder-tasks-list"
            class:contains-task-list={rendering === 'theme'}
          >
            {#each group.tasks as task (task.sourceFile.path + ':' + task.sourceLine)}
              <TaskItem
                task={task}
                model={model}
                checkboxStyle={checkboxStyle}
                rendering={rendering}
                app={app}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
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
