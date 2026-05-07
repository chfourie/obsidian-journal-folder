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
    isJournalFileBasename,
    type JournalFolderSettings,
    type JournalNote,
    type SidebarMode,
  } from '../../data-access'
  import {
    resolveDynamicSelection,
    resolveSelectedFolder,
  } from './sidebar-selection'
  import type {
    ActiveFileSnapshot,
    SidebarUpdateApi,
  } from './journal-folder-sidebar-view'
  import SidebarCalendar from './SidebarCalendar.svelte'
  import { todayDailyBasename } from './sidebar-anchor'

  type Props = {
    initialSettings: JournalFolderSettings
    initialKnownFolders: string[]
    initialActiveFile: ActiveFileSnapshot | null
    saveSettings: (s: JournalFolderSettings) => Promise<void>
    registerApi: (api: SidebarUpdateApi) => void
    onInitJournalFolder: () => void
    buildAnchorNote: (
      folderPath: string,
      anchorBasename: string
    ) => JournalNote | null
    confirmCreate: (basename: string) => Promise<boolean>
    navigate: (url: string, sourceFolderPath: string) => void
  }

  // svelte-ignore state_referenced_locally
  const {
    initialSettings,
    initialKnownFolders,
    initialActiveFile,
    saveSettings,
    registerApi,
    onInitJournalFolder,
    buildAnchorNote,
    confirmCreate,
    navigate,
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
  registerApi({
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
  function calendarToday() {
    anchorBasename = todayDailyBasename()
    calendarOffset = 0
  }

  function calendarNavigate(url: string) {
    navigate(url, selected)
  }
</script>

<div class="jf-sidebar-root">
  <div class="jf-sidebar-section">
    <div class="jf-sidebar-header">
      <label class="jf-sidebar-label" for="jf-sidebar-folder">Journal folder</label>
      <span
        role="button"
        tabindex="0"
        class="jf-sidebar-link jf-sidebar-mode-link"
        onclick={toggleMode}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleMode()
          }
        }}
        title={settings.sidebarMode === 'dynamic'
          ? 'Following the active note. Click to hold the selected folder instead.'
          : 'Holding the selected folder. Click to follow the active note instead.'}
      >
        {settings.sidebarMode === 'dynamic' ? 'Dynamic' : 'Static'}
      </span>
    </div>

    <select
      id="jf-sidebar-folder"
      class="dropdown"
      bind:value={selected}
      disabled={knownFolders.length === 0}
    >
      {#each knownFolders as folder}
        <option value={folder}>{folderLabel(folder)}</option>
      {/each}
      {#if knownFolders.length === 0}
        <option value="">(no journal folders found)</option>
      {/if}
    </select>

    <div class="jf-sidebar-row">
      {#if !isDefault && knownFolders.includes(settings.defaultJournalFolder)}
        <span
          role="button"
          tabindex="0"
          class="jf-sidebar-link"
          onclick={switchToDefault}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              switchToDefault()
            }
          }}
        >
          Switch to default
        </span>
      {/if}
      {#if knownFolders.includes(selected) && !isDefault}
        <span
          role="button"
          tabindex="0"
          class="jf-sidebar-link"
          onclick={setAsDefault}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setAsDefault()
            }
          }}
        >
          Set as default
        </span>
      {/if}
    </div>
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
        onToday={calendarToday}
      />
    {:else}
      <p class="jf-sidebar-help">
        {#if knownFolders.length === 0}
          No journal folders yet — initialise one below to start.
        {:else}
          Pick a journal folder to show its calendar.
        {/if}
      </p>
    {/if}
  </div>

  <div class="jf-sidebar-section jf-sidebar-actions">
    <span class="jf-sidebar-link is-disabled" aria-disabled="true">
      Edit folder configuration
    </span>
    <span
      role="button"
      tabindex="0"
      class="jf-sidebar-link"
      onclick={onInitJournalFolder}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onInitJournalFolder()
        }
      }}
    >
      Initialize a new journal folder
    </span>
  </div>
</div>
