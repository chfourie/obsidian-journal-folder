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
  import { SvelteSet } from 'svelte/reactivity'
  import type { JournalFolderSettings } from '../../data-access'
  import {
    resolveTaskModel,
    type TaskPanelSnapshot,
  } from '../journal-tasks'
  import TaskList from '../journal-tasks/TaskList.svelte'
  import type {
    MenuTrigger,
    TasksOnlyUpdateApi,
  } from './journal-tasks-sidebar-view'

  type Props = {
    initialSettings: JournalFolderSettings
    initialSnapshot: TaskPanelSnapshot
    saveSettings: (s: JournalFolderSettings) => Promise<void>
    registerApi: (api: TasksOnlyUpdateApi) => void
    obsidianApp: App
    openTaskScopeMenu: (trigger: MenuTrigger) => void
    openPluginSettings: () => void
  }

  // svelte-ignore state_referenced_locally
  const {
    initialSettings,
    initialSnapshot,
    saveSettings,
    registerApi,
    obsidianApp,
    openTaskScopeMenu,
    openPluginSettings,
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let settings = $state<JournalFolderSettings>(initialSettings)
  // svelte-ignore state_referenced_locally
  let snapshot = $state<TaskPanelSnapshot>(initialSnapshot)

  // Owned here so every tasks-only sidebar leaf gets its own
  // collapsed-paths state, separate from every other TaskList view.
  const collapsedNotePaths = new SvelteSet<string>()

  // svelte-ignore state_referenced_locally
  registerApi({
    setSettings: (s) => {
      settings = s
    },
    setSnapshot: (s) => {
      snapshot = s
    },
  })

  const taskModel = $derived(resolveTaskModel(settings))
  const visibleTasks = $derived(
    settings.tasksShowCompleted
      ? snapshot.tasks
      : snapshot.tasks.filter((t) => !taskModel.isDone(t.status))
  )
  const hiddenCompletedCount = $derived(
    snapshot.tasks.length - visibleTasks.length
  )

  async function toggleReference() {
    const next =
      settings.tasksSidebarReference === 'today' ? 'dynamic' : 'today'
    await saveSettings({ ...settings, tasksSidebarReference: next })
  }

  async function toggleShowCompleted() {
    await saveSettings({
      ...settings,
      tasksShowCompleted: !settings.tasksShowCompleted,
    })
  }
</script>

<div class="journal-tasks-sidebar-root">
  <TaskList
    tasks={visibleTasks}
    model={taskModel}
    checkboxStyle={settings.taskCheckboxStyle}
    rendering={settings.taskCheckboxRendering}
    app={obsidianApp}
    showCompleted={settings.tasksShowCompleted}
    hiddenCompletedCount={hiddenCompletedCount}
    totalBeforeCap={snapshot.totalBeforeCap}
    header="sidebar"
    collapsedNotePaths={collapsedNotePaths}
    referenceMode={settings.tasksSidebarReference}
    onToggleReference={toggleReference}
    onToggleShowCompleted={toggleShowCompleted}
    onOpenScopeMenu={(e) => openTaskScopeMenu(
      e instanceof MouseEvent
        ? { kind: 'mouse', event: e }
        : { kind: 'keyboard', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }
    )}
    onOpenSettings={openPluginSettings}
  />
</div>
