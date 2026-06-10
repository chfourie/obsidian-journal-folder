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
    TasksSidebarAnchor,
    TasksSidebarFolderMode,
    TasksSidebarRange,
  } from '../../data-access'

  type Props = {
    anchor: TasksSidebarAnchor
    range: TasksSidebarRange
    folderMode: TasksSidebarFolderMode
    selectedFolder: string
    showCompleted: boolean
    quartersEnabled: boolean
    // Lazily resolved when the panel opens so the folder list is always
    // current (no reactive plumbing through the view).
    getFolders: () => string[]
    onSetAnchor: (anchor: TasksSidebarAnchor) => void
    onSetRange: (range: TasksSidebarRange) => void
    onSetFolderMode: (mode: TasksSidebarFolderMode) => void
    onSetFolder: (path: string) => void
    onToggleShowCompleted: () => void
  }

  const {
    anchor,
    range,
    folderMode,
    selectedFolder,
    showCompleted,
    quartersEnabled,
    getFolders,
    onSetAnchor,
    onSetRange,
    onSetFolderMode,
    onSetFolder,
    onToggleShowCompleted,
  }: Props = $props()

  const ANCHOR_OPTIONS: { value: TasksSidebarAnchor; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'note', label: 'Current note' },
  ]

  const RANGE_OPTIONS: { value: TasksSidebarRange; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All' },
  ]

  const rangeOptions = $derived(
    RANGE_OPTIONS.filter((o) => o.value !== 'quarter' || quartersEnabled)
  )

  const folderLabel = (path: string) =>
    path === '' || path === '/' ? '(vault root)' : path

  type FolderRow =
    | { kind: 'note'; label: string }
    | { kind: 'all'; label: string }
    | { kind: 'specific'; label: string; path: string }

  let folders = $state<string[]>([])
  const folderRows = $derived.by<FolderRow[]>(() => {
    const rows: FolderRow[] = [
      { kind: 'note', label: "Current note's folder" },
      { kind: 'all', label: 'All journal folders' },
    ]
    for (const f of folders) {
      rows.push({ kind: 'specific', label: folderLabel(f), path: f })
    }
    return rows
  })

  function isFolderRowSelected(row: FolderRow): boolean {
    if (folderMode === 'note') return row.kind === 'note'
    if (folderMode === 'all') return row.kind === 'all'
    return row.kind === 'specific' && row.path === selectedFolder
  }

  function selectFolderRow(row: FolderRow) {
    if (row.kind === 'note') onSetFolderMode('note')
    else if (row.kind === 'all') onSetFolderMode('all')
    else onSetFolder(row.path)
  }

  let open = $state(false)
  let triggerEl: HTMLElement | undefined = $state()
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')

  // Move the panel to <body> so it isn't clipped by the sidebar's
  // scroll container or the editor's CodeMirror widgets.
  function portal(node: HTMLElement) {
    activeDocument.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function updatePanelPosition() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const gap = 6
    const width = panelEl?.offsetWidth ?? 220
    // Right-align under the trigger (it sits at the panel's right edge),
    // clamped into the viewport.
    let left = rect.right - width
    if (left < 8) left = 8
    if (left + width > activeWindow.innerWidth - 8) {
      left = Math.max(8, activeWindow.innerWidth - width - 8)
    }
    panelStyle = `top: ${rect.bottom + gap}px; left: ${left}px;`
  }

  function openPanel() {
    folders = getFolders()
    open = true
    window.requestAnimationFrame(updatePanelPosition)
  }

  function closePanel() {
    open = false
  }

  function toggle() {
    if (open) closePanel()
    else openPanel()
  }

  function activate(handler: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handler()
      }
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!open) return
    const target = event.target as Node | null
    if (target && triggerEl && triggerEl.contains(target)) return
    if (target && panelEl && panelEl.contains(target)) return
    closePanel()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') closePanel()
  }

  function handleViewportChange() {
    if (open) updatePanelPosition()
  }

  $effect(() => {
    if (!open) return
    // Capture-phase scroll catches scrolling on any ancestor (the
    // sidebar pane scrolls, not window).
    activeDocument.addEventListener('scroll', handleViewportChange, true)
    return () =>
      activeDocument.removeEventListener('scroll', handleViewportChange, true)
  })
</script>

<svelte:window
  onclick={handleDocumentClick}
  onkeydown={handleKeydown}
  onresize={handleViewportChange}
/>

<span
  bind:this={triggerEl}
  role="button"
  tabindex="0"
  class="journal-folder-tasks-scope-trigger"
  class:open
  aria-haspopup="menu"
  aria-expanded={open}
  aria-label="Configure task scope"
  title="Configure task scope"
  data-jf-scope-trigger
  onclick={toggle}
  onkeydown={activate(toggle)}
>
  Scope
  <span class="journal-folder-tasks-scope-caret" aria-hidden="true">▾</span>
</span>

{#snippet option(
  label: string,
  selected: boolean,
  onSelect: () => void,
  testValue?: string
)}
  <span
    role="menuitemradio"
    tabindex="0"
    aria-checked={selected}
    class="journal-folder-tasks-scope-option"
    class:is-selected={selected}
    data-jf-scope-option={testValue}
    onclick={onSelect}
    onkeydown={activate(onSelect)}
  >
    <span class="journal-folder-tasks-scope-check" aria-hidden="true">
      {selected ? '✓' : ''}
    </span>
    <span class="journal-folder-tasks-scope-option-label">{label}</span>
  </span>
{/snippet}

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="journal-folder-tasks-scope-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
    data-jf-scope-panel
  >
    <div class="journal-folder-tasks-scope-section" data-jf-scope-section="anchor">
      <div class="journal-folder-tasks-scope-section-label">Anchor</div>
      <div class="journal-folder-tasks-scope-rule"></div>
      {#each ANCHOR_OPTIONS as opt (opt.value)}
        {@render option(opt.label, anchor === opt.value, () =>
          onSetAnchor(opt.value)
        , 'anchor:' + opt.value)}
      {/each}
    </div>

    <div class="journal-folder-tasks-scope-section" data-jf-scope-section="range">
      <div class="journal-folder-tasks-scope-section-label">Range</div>
      <div class="journal-folder-tasks-scope-rule"></div>
      {#each rangeOptions as opt (opt.value)}
        {@render option(opt.label, range === opt.value, () =>
          onSetRange(opt.value)
        , 'range:' + opt.value)}
      {/each}
    </div>

    <div class="journal-folder-tasks-scope-section" data-jf-scope-section="folders">
      <div class="journal-folder-tasks-scope-section-label">In folders</div>
      <div class="journal-folder-tasks-scope-rule"></div>
      <div class="journal-folder-tasks-scope-folders">
        {#each folderRows as row (row.kind + ('path' in row ? ':' + row.path : ''))}
          {@render option(row.label, isFolderRowSelected(row), () =>
            selectFolderRow(row)
          , 'folder:' + (row.kind === 'specific' ? row.path : row.kind))}
        {/each}
      </div>
    </div>

    <div class="journal-folder-tasks-scope-section" data-jf-scope-section="filter">
      <div class="journal-folder-tasks-scope-section-label">Filter</div>
      <div class="journal-folder-tasks-scope-rule"></div>
      {@render option('Show completed tasks', showCompleted, onToggleShowCompleted, 'filter:show-completed')}
    </div>
  </div>
{/if}
