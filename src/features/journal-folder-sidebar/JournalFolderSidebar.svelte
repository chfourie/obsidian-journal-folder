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
    JournalFolderSettings,
    SidebarMode,
  } from '../../data-access'
  import {
    resolveDynamicSelection,
    resolveSelectedFolder,
  } from './sidebar-selection'
  import type {
    ActiveFileSnapshot,
    SidebarUpdateApi,
  } from './journal-folder-sidebar-view'

  type Props = {
    initialSettings: JournalFolderSettings
    initialKnownFolders: string[]
    initialActiveFile: ActiveFileSnapshot | null
    saveSettings: (s: JournalFolderSettings) => Promise<void>
    registerApi: (api: SidebarUpdateApi) => void
  }

  // svelte-ignore state_referenced_locally
  const {
    initialSettings,
    initialKnownFolders,
    initialActiveFile,
    saveSettings,
    registerApi,
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
    },
  })

  const folderLabel = (path: string) =>
    path === '' || path === '/' ? '(vault root)' : path

  const isDefault = $derived(selected === settings.defaultJournalFolder)

  async function setMode(mode: SidebarMode) {
    if (settings.sidebarMode === mode) return
    await saveSettings({ ...settings, sidebarMode: mode })
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
</script>

<div class="jf-sidebar-root">
  <div class="jf-sidebar-section">
    <label class="jf-sidebar-label" for="jf-sidebar-folder">Journal folder</label>
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
        <button class="jf-sidebar-btn" type="button" onclick={switchToDefault}>
          Switch to default
        </button>
      {/if}
      {#if knownFolders.includes(selected) && !isDefault}
        <button
          class="jf-sidebar-btn"
          type="button"
          onclick={setAsDefault}
        >
          Set as default
        </button>
      {/if}
    </div>
  </div>

  <div class="jf-sidebar-section">
    <div class="jf-sidebar-mode-toggle" role="tablist" aria-label="Sidebar mode">
      <button
        type="button"
        class="jf-sidebar-mode-btn"
        class:is-active={settings.sidebarMode === 'dynamic'}
        aria-pressed={settings.sidebarMode === 'dynamic'}
        onclick={() => setMode('dynamic')}
      >
        Dynamic
      </button>
      <button
        type="button"
        class="jf-sidebar-mode-btn"
        class:is-active={settings.sidebarMode === 'static'}
        aria-pressed={settings.sidebarMode === 'static'}
        onclick={() => setMode('static')}
      >
        Static
      </button>
    </div>
    <p class="jf-sidebar-help">
      {#if settings.sidebarMode === 'dynamic'}
        Following the active note when it lives in a journal folder.
      {:else}
        Holding the selected folder regardless of which note is open.
      {/if}
    </p>
  </div>

  <div class="jf-sidebar-section jf-sidebar-calendar-placeholder">
    <p class="jf-sidebar-help">Calendar coming in a follow-up update.</p>
  </div>

  <div class="jf-sidebar-section jf-sidebar-actions">
    <button class="jf-sidebar-btn" type="button" disabled>
      Edit folder configuration
    </button>
    <button class="jf-sidebar-btn" type="button" disabled>
      Initialize a new journal folder
    </button>
    <p class="jf-sidebar-help">Both actions land in a follow-up update.</p>
  </div>
</div>
