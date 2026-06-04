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
  import {
    findJournalFolderPaths,
    type JournalFolderSettings,
    type TasksSidebarAnchor,
    type TasksSidebarFolderMode,
    type TasksSidebarRange,
  } from '../../data-access'
  import {
    resolveTaskModel,
    type TaskPanelSnapshot,
  } from '../journal-tasks'
  import TaskList from '../journal-tasks/TaskList.svelte'
  import type { TasksOnlyUpdateApi } from './journal-tasks-sidebar-view'

  type Props = {
    initialSettings: JournalFolderSettings
    initialSnapshot: TaskPanelSnapshot
    saveSettings: (s: JournalFolderSettings) => Promise<void>
    registerApi: (api: TasksOnlyUpdateApi) => void
    obsidianApp: App
    openPluginSettings: () => void
  }

  // svelte-ignore state_referenced_locally
  const {
    initialSettings,
    initialSnapshot,
    saveSettings,
    registerApi,
    obsidianApp,
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
    settings.tasksOnlySidebarShowCompleted
      ? snapshot.tasks
      : snapshot.tasks.filter((t) => !taskModel.isDone(t.status))
  )
  const hiddenCompletedCount = $derived(
    snapshot.tasks.length - visibleTasks.length
  )

  async function setAnchor(anchor: TasksSidebarAnchor) {
    await saveSettings({ ...settings, tasksOnlySidebarAnchor: anchor })
  }

  async function setRange(range: TasksSidebarRange) {
    await saveSettings({ ...settings, tasksOnlySidebarRange: range })
  }

  async function setFolderMode(mode: TasksSidebarFolderMode) {
    await saveSettings({ ...settings, tasksOnlySidebarFolderMode: mode })
  }

  async function setFolder(path: string) {
    await saveSettings({
      ...settings,
      tasksOnlySidebarFolderMode: 'specific',
      tasksOnlySidebarFolder: path,
    })
  }

  async function toggleShowCompleted() {
    await saveSettings({
      ...settings,
      tasksOnlySidebarShowCompleted: !settings.tasksOnlySidebarShowCompleted,
    })
  }

  function taskScopeFolders(): string[] {
    return findJournalFolderPaths(obsidianApp).filter(
      (p) => p !== '' && p !== '/'
    )
  }
</script>

<div class="journal-tasks-sidebar-root">
  <TaskList
    tasks={visibleTasks}
    model={taskModel}
    app={obsidianApp}
    showCompleted={settings.tasksOnlySidebarShowCompleted}
    hiddenCompletedCount={hiddenCompletedCount}
    totalBeforeCap={snapshot.totalBeforeCap}
    truncated={snapshot.truncated}
    header="sidebar"
    collapsedNotePaths={collapsedNotePaths}
    anchor={settings.tasksOnlySidebarAnchor}
    range={settings.tasksOnlySidebarRange}
    folderMode={settings.tasksOnlySidebarFolderMode}
    selectedFolder={settings.tasksOnlySidebarFolder}
    quartersEnabled={!!settings.quartersEnabled}
    getFolders={taskScopeFolders}
    onSetAnchor={setAnchor}
    onSetRange={setRange}
    onSetFolderMode={setFolderMode}
    onSetFolder={setFolder}
    onToggleShowCompleted={toggleShowCompleted}
    onOpenSettings={openPluginSettings}
  />
</div>
