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
  import type { SidebarMenuItem } from '../journal-folder-sidebar'
  import { computeMenuPanelPosition } from '../journal-folder-sidebar/menu-panel-position'

  // The feature drives the panel imperatively: on the ribbon click it passes
  // the ribbon element to anchor against; from the command (mobile, where the
  // ribbon strip doesn't exist) it passes nothing and the panel centres.
  type Props = {
    getItems: () => SidebarMenuItem[]
    registerApi: (api: {
      toggle: (anchor?: HTMLElement | null) => void
      close: () => void
    }) => void
  }

  const { getItems, registerApi }: Props = $props()

  let open = $state(false)
  let items = $state<SidebarMenuItem[]>([])
  // Not reactive — only read inside positioning, which we re-run explicitly.
  let anchorEl: HTMLElement | null = null
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')

  // Reuse the sidebar menu's `<body>` portal + Lucide-icon painter so the panel
  // escapes any clipping container and shares the `.jf-sidebar-menu-*` styling.
  function portal(node: HTMLElement) {
    activeDocument.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
  }

  function updatePanelPosition() {
    const width = panelEl?.offsetWidth ?? 240
    const height = panelEl?.offsetHeight ?? 0
    const rect = anchorEl?.getBoundingClientRect()
    const { top, left } = computeMenuPanelPosition({
      anchor: rect
        ? {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
          }
        : null,
      panel: { width, height },
      viewport: {
        width: activeWindow.innerWidth,
        height: activeWindow.innerHeight,
      },
      placement: 'right',
    })
    panelStyle = `top: ${top}px; left: ${left}px;`
  }

  function openPanel(anchor: HTMLElement | null) {
    anchorEl = anchor ?? null
    items = getItems()
    open = true
    window.requestAnimationFrame(updatePanelPosition)
  }

  function closePanel() {
    open = false
    anchorEl = null
  }

  function toggle(anchor?: HTMLElement | null) {
    if (open) closePanel()
    else openPanel(anchor ?? null)
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
    // The ribbon click that opened us bubbles to window in the same gesture;
    // ignore clicks within the anchor so we don't immediately re-close.
    if (target && anchorEl && anchorEl.contains(target)) return
    if (target && panelEl && panelEl.contains(target)) return
    closePanel()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') closePanel()
  }

  function handleViewportChange() {
    if (open) updatePanelPosition()
  }

  // Hand the imperative controls to the feature once, on mount. An $effect
  // (rather than a bare top-level call) avoids capturing the prop non-reactively
  // and runs well before any user click.
  $effect(() => {
    registerApi({ toggle, close: closePanel })
  })

  $effect(() => {
    if (!open) return
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

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="jf-sidebar-menu-panel jf-ribbon-menu-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
    data-jf-ribbon-menu
  >
    {#each items as item, i (i)}
      {#if item.kind === 'separator'}
        <div class="jf-sidebar-menu-sep"></div>
      {:else}
        <span
          role="menuitem"
          tabindex="0"
          class="jf-sidebar-menu-item"
          data-jf-menu-item
          data-jf-menu-item-title={item.title}
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
