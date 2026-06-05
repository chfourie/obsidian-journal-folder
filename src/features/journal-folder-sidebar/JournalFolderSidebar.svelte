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
  import {
    findJournalFolderPaths,
    isJournalFileBasename,
    type JournalFolderSettings,
    type JournalNote,
    type SidebarMode,
    type TasksSidebarAnchor,
    type TasksSidebarFolderMode,
    type TasksSidebarRange,
  } from '../../data-access'
  import {
    resolveDynamicSelection,
    resolveSelectedFolder,
  } from './sidebar-selection'
  import type {
    ActiveFileSnapshot,
    MenuTrigger,
    SidebarMenuItem,
    SidebarUpdateApi,
    TaskPanelSnapshot,
  } from './journal-folder-sidebar-view'
  import SidebarCalendar from './SidebarCalendar.svelte'
  import SidebarMenuPanel from './SidebarMenuPanel.svelte'
  import TaskList from '../journal-tasks/TaskList.svelte'
  import { resolveTaskModel } from '../journal-tasks'
  import { SvelteSet } from 'svelte/reactivity'
  import { todayDailyBasename } from './sidebar-anchor'
  import {
    anchorMonth,
    shouldShowCurrentLink,
    shouldShowNoteMonthLink,
    todayAnchor,
  } from '../journal-header/calendar-navigation'

  type Props = {
    initialSettings: JournalFolderSettings
    initialKnownFolders: string[]
    initialActiveFile: ActiveFileSnapshot | null
    initialTaskPanel: TaskPanelSnapshot
    saveSettings: (s: JournalFolderSettings) => Promise<void>
    registerApi: (api: SidebarUpdateApi) => void
    onInitJournalFolder: () => void
    onEditFolderConfig: (folderPath: string) => void
    openPluginSettings: () => void
    showMenu: (trigger: MenuTrigger, items: SidebarMenuItem[]) => void
    buildAnchorNote: (
      folderPath: string,
      anchorBasename: string
    ) => JournalNote | null
    confirmCreate: (basename: string) => Promise<boolean>
    navigate: (url: string, sourceFolderPath: string) => void
    obsidianApp: import('obsidian').App
  }

  // svelte-ignore state_referenced_locally
  const {
    initialSettings,
    initialKnownFolders,
    initialActiveFile,
    initialTaskPanel,
    saveSettings,
    registerApi,
    onInitJournalFolder,
    onEditFolderConfig,
    openPluginSettings,
    showMenu,
    buildAnchorNote,
    confirmCreate,
    navigate,
    obsidianApp,
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let settings = $state<JournalFolderSettings>(initialSettings)
  // svelte-ignore state_referenced_locally
  let knownFolders = $state<string[]>(initialKnownFolders)
  // svelte-ignore state_referenced_locally
  let activeFile = $state<ActiveFileSnapshot | null>(initialActiveFile)
  // svelte-ignore state_referenced_locally
  let selected = $state<string>(
    resolveSelectedFolder(
      initialSettings.defaultJournalFolder,
      initialKnownFolders
    )
  )

  // Drives the calendar's "current" highlighted cell. Defaults to today's
  // daily basename; in dynamic mode the active file's basename takes
  // over so the highlighted cell follows wherever the user is reading.
  let anchorBasename = $state<string>(todayDailyBasename())
  // Months relative to the anchor's month — prev/next mutate this, the
  // *Today* control resets it (along with the anchor itself).
  let calendarOffset = $state<number>(0)
  // Bumped every time the vault mutates so the `$derived` anchor note
  // rebuilds. The synthetic anchor's `noteNames` snapshot is captured at
  // construction (see `journal-note.ts → journalNote`), so deletes /
  // renames / creates only flip cell `exists` flags after a rebuild.
  let vaultTick = $state<number>(0)

  // svelte-ignore state_referenced_locally
  let taskPanel = $state<TaskPanelSnapshot>(initialTaskPanel)

  // Per-sidebar-instance collapsed-paths set. Owned here so the
  // sidebar's collapse state is independent of every other TaskList
  // surface (in-note blocks, other sidebar leaves) and survives
  // task-panel snapshot updates.
  const sidebarCollapsedPaths = new SvelteSet<string>()

  // svelte-ignore state_referenced_locally
  registerApi({
    setTaskPanelSnapshot: (snapshot) => {
      taskPanel = snapshot
    },
    setSettings: (s) => {
      settings = s
      // If the user changed the default folder externally and the picker
      // is currently sitting on a folder that no longer exists, snap to a
      // sensible value.
      if (!knownFolders.includes(selected)) {
        selected = resolveSelectedFolder(s.defaultJournalFolder, knownFolders)
      }
    },
    setKnownFolders: (folders) => {
      knownFolders = folders
      if (!folders.includes(selected)) {
        selected = resolveSelectedFolder(settings.defaultJournalFolder, folders)
      }
    },
    setActiveFile: (file) => {
      activeFile = file
      if (settings.sidebarMode !== 'dynamic') return
      const next = resolveDynamicSelection({
        activeFilePath: file?.path ?? null,
        activeFileBasename: file?.basename ?? null,
        activeFileParentPath: file?.parentPath ?? null,
        knownFolders,
        currentSelection: selected,
        quartersEnabled: !!settings.quartersEnabled,
      })
      if (next !== null) selected = next
      // Even when the parent folder didn't change (already-selected case),
      // dynamic mode should scroll the calendar to the active note's
      // period so the user sees the current cell highlighted. Only do
      // this when the active file is actually a journal note in the
      // current selection — non-journal notes leave the calendar alone.
      if (
        file &&
        file.parentPath === selected &&
        isJournalFileBasename(file.basename, !!settings.quartersEnabled)
      ) {
        anchorBasename = file.basename
        calendarOffset = 0
      }
    },
    setSelected: (path) => {
      if (knownFolders.includes(path)) selected = path
    },
    bumpVault: () => {
      vaultTick += 1
    },
  })

  const folderLabel = (path: string) =>
    path === '' || path === '/' ? '(vault root)' : path

  const isDefault = $derived(selected === settings.defaultJournalFolder)

  async function toggleMode() {
    const next: SidebarMode =
      settings.sidebarMode === 'dynamic' ? 'static' : 'dynamic'
    await saveSettings({ ...settings, sidebarMode: next })
  }

  async function setAsDefault() {
    if (selected === settings.defaultJournalFolder) return
    await saveSettings({ ...settings, defaultJournalFolder: selected })
  }

  function switchToDefault() {
    if (knownFolders.includes(settings.defaultJournalFolder)) {
      selected = settings.defaultJournalFolder
    }
  }

  // Reset the calendar anchor whenever the user switches folders — the
  // previous anchor (potentially a daily-basename from the prior folder)
  // is meaningless in the new folder's context.
  // svelte-ignore state_referenced_locally
  let lastSelected = selected
  $effect(() => {
    if (selected !== lastSelected) {
      lastSelected = selected
      anchorBasename = todayDailyBasename()
      calendarOffset = 0
    }
  })

  const anchorNote = $derived.by(() => {
    // Reading vaultTick here makes this derived recompute on every vault
    // mutation, which rebuilds the synthetic anchor against the current
    // `parent.children` snapshot.
    void vaultTick
    return selected ? buildAnchorNote(selected, anchorBasename) : null
  })

  function calendarPrev() {
    calendarOffset -= 1
  }
  function calendarNext() {
    calendarOffset += 1
  }
  function calendarCurrent() {
    anchorBasename = todayDailyBasename()
    calendarOffset = 0
  }
  function calendarNoteMonth() {
    if (activeNoteBasename) {
      anchorBasename = activeNoteBasename
      calendarOffset = 0
    }
  }

  function calendarNavigate(url: string) {
    navigate(url, selected)
  }

  // Active note's basename when (a) the active file is in the selected
  // folder, and (b) its basename is a recognised journal pattern. Used
  // to drive the *Note month* jump link — `null` hides the link entirely.
  const activeNoteBasename = $derived.by(() => {
    if (!activeFile) return null
    if (activeFile.parentPath !== selected) return null
    if (
      !isJournalFileBasename(
        activeFile.basename,
        !!settings.quartersEnabled
      )
    ) {
      return null
    }
    return activeFile.basename
  })

  // The active note as a JournalNote, when there is one, so we can read
  // its `getMoment()` for the *Note month* anchor target.
  const activeNoteAsJournalNote = $derived.by(() => {
    void vaultTick // rebuild on vault mutations, same reason as anchorNote
    if (!activeNoteBasename) return null
    return buildAnchorNote(selected, activeNoteBasename)
  })

  const visibleAnchor = $derived(
    anchorNote
      ? anchorMonth(anchorNote.getMoment(), calendarOffset)
      : null
  )
  const noteMonthAnchor = $derived(
    activeNoteAsJournalNote
      ? anchorMonth(activeNoteAsJournalNote.getMoment(), 0)
      : null
  )
  const todayMonthAnchor = $derived(todayAnchor())
  const showCalendarCurrent = $derived(
    !!visibleAnchor && shouldShowCurrentLink(visibleAnchor, todayMonthAnchor)
  )
  const showCalendarNoteMonth = $derived(
    !!visibleAnchor &&
      shouldShowNoteMonthLink(visibleAnchor, noteMonthAnchor, todayMonthAnchor)
  )

  function buildMenuItems(): SidebarMenuItem[] {
    const items: SidebarMenuItem[] = []
    const isDynamic = settings.sidebarMode === 'dynamic'
    items.push({
      kind: 'item',
      title: isDynamic ? 'Switch to static' : 'Switch to dynamic',
      icon: isDynamic ? 'pin' : 'navigation',
      onClick: toggleMode,
    })

    const canSwitchToDefault =
      !isDefault && knownFolders.includes(settings.defaultJournalFolder)
    const canSetAsDefault = knownFolders.includes(selected) && !isDefault

    if (canSwitchToDefault || canSetAsDefault) {
      items.push({ kind: 'separator' })
      if (canSwitchToDefault) {
        items.push({
          kind: 'item',
          title: 'Switch to default folder',
          icon: 'home',
          onClick: switchToDefault,
        })
      }
      if (canSetAsDefault) {
        items.push({
          kind: 'item',
          title: 'Set as default folder',
          icon: 'star',
          onClick: setAsDefault,
        })
      }
    }

    items.push({ kind: 'separator' })
    items.push({
      kind: 'item',
      title: settings.tasksSidebarEnabled
        ? 'Hide task panel'
        : 'Show task panel',
      icon: settings.tasksSidebarEnabled ? 'eye-off' : 'eye',
      onClick: toggleTasksPanel,
    })

    items.push({ kind: 'separator' })
    if (knownFolders.includes(selected)) {
      items.push({
        kind: 'item',
        title: 'Edit folder configuration',
        icon: 'settings',
        onClick: () => onEditFolderConfig(selected),
      })
    }
    items.push({
      kind: 'item',
      title: 'Initialise a new journal folder',
      icon: 'folder-plus',
      onClick: onInitJournalFolder,
    })

    return items
  }

  async function toggleTasksPanel() {
    await saveSettings({
      ...settings,
      tasksSidebarEnabled: !settings.tasksSidebarEnabled,
    })
  }

  function buildFolderMenuItems(): SidebarMenuItem[] {
    if (knownFolders.length === 0) {
      return [
        {
          kind: 'item',
          title: '(no journal folders found)',
          onClick: () => {},
        },
      ]
    }
    return knownFolders.map((folder) => ({
      kind: 'item',
      title: folderLabel(folder),
      icon: folder === selected ? 'check' : undefined,
      onClick: () => {
        selected = folder
      },
    }))
  }

  const taskModel = $derived(resolveTaskModel(settings))
  const visibleTasks = $derived(
    settings.tasksShowCompleted
      ? taskPanel.tasks
      : taskPanel.tasks.filter((t) => !taskModel.isDone(t.status))
  )
  const hiddenCompletedCount = $derived(
    taskPanel.tasks.length - visibleTasks.length
  )

  async function setTasksAnchor(anchor: TasksSidebarAnchor) {
    await saveSettings({ ...settings, tasksSidebarAnchor: anchor })
  }

  async function setTasksRange(range: TasksSidebarRange) {
    await saveSettings({ ...settings, tasksSidebarRange: range })
  }

  async function setTasksFolderMode(mode: TasksSidebarFolderMode) {
    await saveSettings({ ...settings, tasksSidebarFolderMode: mode })
  }

  async function setTasksFolder(path: string) {
    await saveSettings({
      ...settings,
      tasksSidebarFolderMode: 'specific',
      tasksSidebarFolder: path,
    })
  }

  async function toggleTasksShowCompleted() {
    await saveSettings({
      ...settings,
      tasksShowCompleted: !settings.tasksShowCompleted,
    })
  }

  // Journal folders offered in the scope panel's "specific folder"
  // list. Resolved lazily at panel-open time so it's always current;
  // the vault root is never a journal folder.
  function taskScopeFolders(): string[] {
    return findJournalFolderPaths(obsidianApp).filter(
      (p) => p !== '' && p !== '/'
    )
  }

  function openFolderMenu(evt: MouseEvent | KeyboardEvent) {
    if (evt instanceof MouseEvent) {
      showMenu({ kind: 'mouse', event: evt }, buildFolderMenuItems())
      return
    }
    const target = evt.currentTarget as HTMLElement | null
    if (!target) return
    showMenu(
      { kind: 'keyboard', rect: target.getBoundingClientRect() },
      buildFolderMenuItems()
    )
  }
</script>

<div class="jf-sidebar-root">
  <div class="jf-sidebar-section">
    <div class="jf-sidebar-header">
      <label class="jf-sidebar-label" for="jf-sidebar-folder">
        Journal folder
        <span class="jf-sidebar-label-mode">
          ({settings.sidebarMode === 'dynamic' ? 'Dynamic' : 'Static'})
        </span>
      </label>
      <SidebarMenuPanel label="More..." getItems={buildMenuItems} />
    </div>

    <span
      id="jf-sidebar-folder"
      role="button"
      tabindex="0"
      class="jf-sidebar-folder-button"
      class:is-disabled={knownFolders.length === 0}
      aria-haspopup="menu"
      aria-disabled={knownFolders.length === 0}
      onclick={(e) => {
        if (knownFolders.length === 0) return
        openFolderMenu(e)
      }}
      onkeydown={(e) => {
        if (knownFolders.length === 0) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openFolderMenu(e)
        }
      }}
    >
      <span class="jf-sidebar-folder-button-label">
        {knownFolders.length === 0
          ? '(no journal folders found)'
          : folderLabel(selected)}
      </span>
      <span class="jf-sidebar-folder-button-caret" aria-hidden="true">▾</span>
    </span>
  </div>

  <div class="jf-sidebar-section">
    {#if anchorNote}
      <SidebarCalendar
        note={anchorNote}
        offsetMonths={calendarOffset}
        confirmCreate={confirmCreate}
        navigate={calendarNavigate}
        onPrev={calendarPrev}
        onNext={calendarNext}
        setOffsetMonths={(o) => (calendarOffset = o)}
        showCurrent={showCalendarCurrent}
        showNoteMonth={showCalendarNoteMonth}
        onCurrent={calendarCurrent}
        onNoteMonth={calendarNoteMonth}
      />
    {:else}
      <p class="jf-sidebar-help">
        {#if knownFolders.length === 0}
          No journal folders yet — pick <em>Initialise a new journal folder</em> from the
          <strong>More...</strong> menu to get started.
        {:else}
          Pick a journal folder to show its calendar.
        {/if}
      </p>
    {/if}
  </div>

  {#if settings.tasksSidebarEnabled}
    <hr class="jf-sidebar-divider" />
    <div class="jf-sidebar-section">
      <TaskList
        tasks={visibleTasks}
        model={taskModel}
        app={obsidianApp}
        showCompleted={settings.tasksShowCompleted}
        hiddenCompletedCount={hiddenCompletedCount}
        totalBeforeCap={taskPanel.totalBeforeCap}
        truncated={taskPanel.truncated}
        header="sidebar"
        collapsedNotePaths={sidebarCollapsedPaths}
        signifiers={settings.signifiers}
        categories={settings.taskCategories}
        categoryShowUnderNote={settings.taskCategoryShowUnderNote}
        anchor={settings.tasksSidebarAnchor}
        range={settings.tasksSidebarRange}
        folderMode={settings.tasksSidebarFolderMode}
        selectedFolder={settings.tasksSidebarFolder}
        quartersEnabled={!!settings.quartersEnabled}
        getFolders={taskScopeFolders}
        onSetAnchor={setTasksAnchor}
        onSetRange={setTasksRange}
        onSetFolderMode={setTasksFolderMode}
        onSetFolder={setTasksFolder}
        onToggleShowCompleted={toggleTasksShowCompleted}
        onOpenSettings={openPluginSettings}
      />
    </div>
  {/if}
</div>
