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
  import { setIcon } from 'obsidian'
  import type { SidebarMenuItem } from './journal-folder-sidebar-view'

  type Props = {
    label: string
    // Resolved lazily when the panel opens so item visibility / titles
    // reflect the current settings + selection.
    getItems: () => SidebarMenuItem[]
  }

  const { label, getItems }: Props = $props()

  let open = $state(false)
  let items = $state<SidebarMenuItem[]>([])
  let triggerEl: HTMLElement | undefined = $state()
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')

  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  // Obsidian's `setIcon` paints a Lucide glyph into the node.
  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
  }

  function updatePanelPosition() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const gap = 6
    const width = panelEl?.offsetWidth ?? 220
    let left = rect.right - width
    if (left < 8) left = 8
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    panelStyle = `top: ${rect.bottom + gap}px; left: ${left}px;`
  }

  function openPanel() {
    items = getItems()
    open = true
    requestAnimationFrame(updatePanelPosition)
  }

  function closePanel() {
    open = false
  }

  function toggle() {
    if (open) closePanel()
    else openPanel()
  }

  function runItem(onClick: () => void) {
    closePanel()
    onClick()
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
    document.addEventListener('scroll', handleViewportChange, true)
    return () =>
      document.removeEventListener('scroll', handleViewportChange, true)
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
  class="jf-sidebar-link jf-sidebar-more-link"
  class:open
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={toggle}
  onkeydown={activate(toggle)}
>
  {label}
</span>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="jf-sidebar-menu-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each items as item, i (i)}
      {#if item.kind === 'separator'}
        <div class="jf-sidebar-menu-sep"></div>
      {:else}
        <span
          role="menuitem"
          tabindex="0"
          class="jf-sidebar-menu-item"
          onclick={() => runItem(item.onClick)}
          onkeydown={activate(() => runItem(item.onClick))}
        >
          <span class="jf-sidebar-menu-icon" aria-hidden="true">
            {#if item.icon}
              <span use:icon={item.icon}></span>
            {/if}
          </span>
          <span class="jf-sidebar-menu-item-label">{item.title}</span>
        </span>
      {/if}
    {/each}
  </div>
{/if}
