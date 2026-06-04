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
  import type { SvelteSet } from 'svelte/reactivity'
  import type {
    JournalTask,
    TasksSidebarAnchor,
    TasksSidebarFolderMode,
    TasksSidebarRange,
  } from '../../data-access'
  import type { TaskModel } from './task-models'
  import TaskItem from './TaskItem.svelte'
  import TaskScopePanel from './TaskScopePanel.svelte'

  type Props = {
    tasks: JournalTask[]
    model: TaskModel
    app: App
    showCompleted: boolean
    hiddenCompletedCount: number
    totalBeforeCap: number
    truncated: boolean
    header: 'sidebar' | 'note'
    // Per-instance reactive set the caller owns. Each TaskList caller
    // (the sidebar, every in-note `journal-tasks` block) constructs
    // its own `new SvelteSet<string>()` so collapse state lives only
    // inside that instance — no two TaskList views share state.
    // The set persists across the caller's own remounts (sidebar
    // snapshot updates, in-note block remounts on vault changes)
    // because the caller keeps the same reference around.
    collapsedNotePaths: SvelteSet<string>
    caption?: string
    // Sidebar scope panel state + setters. Present only for the sidebar
    // surfaces; the in-note block leaves these undefined and keeps its
    // own inline Active/All toggle instead.
    anchor?: TasksSidebarAnchor
    range?: TasksSidebarRange
    folderMode?: TasksSidebarFolderMode
    selectedFolder?: string
    quartersEnabled?: boolean
    getFolders?: () => string[]
    onSetAnchor?: (anchor: TasksSidebarAnchor) => void
    onSetRange?: (range: TasksSidebarRange) => void
    onSetFolderMode?: (mode: TasksSidebarFolderMode) => void
    onSetFolder?: (path: string) => void
    onToggleShowCompleted?: () => void
    onOpenSettings?: () => void
  }

  const {
    tasks,
    model,
    app,
    showCompleted,
    hiddenCompletedCount,
    totalBeforeCap,
    truncated,
    header,
    collapsedNotePaths,
    caption,
    anchor,
    range,
    folderMode,
    selectedFolder,
    quartersEnabled,
    getFolders,
    onSetAnchor,
    onSetRange,
    onSetFolderMode,
    onSetFolder,
    onToggleShowCompleted,
    onOpenSettings,
  }: Props = $props()

  const captionText = $derived(caption && caption.trim() ? caption : 'TASKS')
  const headerLabel = $derived.by(() => {
    if (showCompleted) return `${captionText} (${tasks.length})`
    return `${captionText} (${tasks.length} · ${hiddenCompletedCount} ✓ hidden)`
  })

  // `truncated` is supplied by the caller; the snapshot/feature is the
  // only level that knows the cap was actually hit. Don't derive it
  // from `totalBeforeCap > tasks.length` here — that conflates the
  // size cap with the completed-status filter and shows the footer
  // whenever any task is hidden by *Active tasks*.

  // The sidebar surfaces drive reference + folder scope through the
  // scope panel; the in-note block keeps the lightweight inline toggle.
  const showScopePanel = $derived(
    header === 'sidebar' && !!onSetAnchor
  )

  // Compact human-readable summary of the active scope, shown read-only
  // under the header so the selection is visible without opening the
  // panel: `<anchor> · <range> · <folders> · <filter>`.
  const RANGE_LABELS: Record<TasksSidebarRange, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    quarter: 'Quarter',
    year: 'Year',
    all: 'All',
  }
  function lastSegment(path: string): string {
    if (path === '' || path === '/') return '(vault root)'
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }
  const scopeSummary = $derived.by(() => {
    const anchorLabel = anchor === 'today' ? 'Today' : 'Current note'
    const rangeLabel = RANGE_LABELS[range ?? 'day']
    const folderText =
      folderMode === 'note'
        ? 'Current folder'
        : folderMode === 'specific' && selectedFolder
          ? lastSegment(selectedFolder)
          : 'All folders'
    const filterLabel = showCompleted ? 'All tasks' : 'Active'
    return `${anchorLabel} · ${rangeLabel} · ${folderText} · ${filterLabel}`
  })

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
</script>

<div class="journal-folder-tasks">
  <div class="journal-folder-tasks-header">
    <span class="journal-folder-tasks-header-label">{headerLabel}</span>
    {#if showScopePanel}
      <TaskScopePanel
        anchor={anchor ?? 'today'}
        range={range ?? 'day'}
        folderMode={folderMode ?? 'all'}
        selectedFolder={selectedFolder ?? ''}
        showCompleted={showCompleted}
        quartersEnabled={!!quartersEnabled}
        getFolders={getFolders ?? (() => [])}
        onSetAnchor={onSetAnchor!}
        onSetRange={onSetRange!}
        onSetFolderMode={onSetFolderMode!}
        onSetFolder={onSetFolder!}
        onToggleShowCompleted={onToggleShowCompleted ?? (() => {})}
      />
    {/if}
  </div>
  {#if showScopePanel}
    <div class="journal-folder-tasks-controls">
      <span class="journal-folder-tasks-summary">{scopeSummary}</span>
    </div>
  {:else if onToggleShowCompleted}
    <div class="journal-folder-tasks-controls">
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
        <div class="journal-folder-tasks-group-heading">
          <span
            class="journal-folder-tasks-group-caret"
            role="button"
            tabindex="0"
            aria-label={collapsed ? 'Expand group' : 'Collapse group'}
            aria-expanded={!collapsed}
            onclick={() => toggleCollapsed(group.path)}
            onkeydown={activate(() => toggleCollapsed(group.path))}
          >{collapsed ? '▸' : '▾'}</span>
          <span
            class="journal-folder-tasks-group-title"
            role="button"
            tabindex="0"
            title="Open this note"
            onclick={() => openGroupNote(group.path)}
            onkeydown={activate(() => openGroupNote(group.path))}
          >{group.title}</span>
          <span class="journal-folder-tasks-group-count">
            ({group.tasks.length})
          </span>
        </div>
        {#if !collapsed}
          <div
            class="journal-folder-tasks-list contains-task-list"
          >
            {#each group.tasks as task (task.sourceFile.path + ':' + task.sourceLine)}
              <TaskItem
                task={task}
                model={model}
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
