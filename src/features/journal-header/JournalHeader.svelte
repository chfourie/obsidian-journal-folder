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
	import { NoteLink } from '../../ui'
	import type { JournalHeaderInfo } from './journal-header-info'
	import type { JournalNote } from '../../data-access'
	import JournalCalendar from './JournalCalendar.svelte'
	import {
		applyCalendarDefault,
		calendarVisible,
		toggleCalendar,
	} from './calendar-visibility'
	import { findInternalLinkHref } from './internal-link-target'

	type Props = {
		info: JournalHeaderInfo
		note: JournalNote
		confirmCreate: (basename: string) => Promise<boolean>
		navigate: (linktext: string) => void
		defaultCalendarVisible: boolean
		isMobile: boolean
	}

	let {
		info,
		note,
		confirmCreate,
		navigate,
		defaultCalendarVisible,
		isMobile,
	}: Props = $props()

	// Apply the resolved default once per header mount. The helper is a
	// no-op once the user has manually toggled this session, so navigating
	// between folders with different defaults won't override an explicit
	// user choice.
	$effect(() => {
		applyCalendarDefault(defaultCalendarVisible)
	})

	let moreOpen = $state(false)
	let moreWrapper: HTMLElement | undefined = $state()
	let panelEl: HTMLElement | undefined = $state()
	let panelStyle = $state('')

	// Move the panel to <body> so it isn't clipped by CodeMirror widget
	// containers in live-preview mode.
	function portal(node: HTMLElement) {
		document.body.appendChild(node)
		return {
			destroy() {
				node.remove()
			},
		}
	}

	function updatePanelPosition() {
		if (!moreWrapper) return
		const optionsEl = moreWrapper.closest(
			'.journal-folder-header-options'
		) as HTMLElement | null
		if (!optionsEl) return
		const rect = optionsEl.getBoundingClientRect()
		const gap = 6
		panelStyle = `top: ${rect.bottom + gap}px; left: ${rect.left}px; width: ${rect.width}px;`
	}

	function toggleMore() {
		moreOpen = !moreOpen
		if (moreOpen) requestAnimationFrame(updatePanelPosition)
	}

	function closeMore() {
		moreOpen = false
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!moreOpen) return
		const target = event.target as Node | null
		if (target && moreWrapper && moreWrapper.contains(target)) return
		if (target && panelEl && panelEl.contains(target)) return
		closeMore()
	}

	function handleKeydown(event: KeyboardEvent) {
		if (moreOpen && event.key === 'Escape') closeMore()
	}

	function handleMoreKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			toggleMore()
		}
	}

	function handleViewportChange() {
		if (moreOpen) updatePanelPosition()
	}

	function handleToggleCalendar() {
		toggleCalendar()
	}

	// The panel is portaled to <body>, so Obsidian's `.internal-link` click
	// handler (scoped to the markdown render container) doesn't fire on its
	// links. Intercept clicks here and route through the injected navigate.
	// `needsConfirmation` links are handled by NoteLink itself — it
	// preventDefaults+stopPropagations the click before it reaches this
	// handler, so we won't double-navigate.
	function handlePanelClick(event: MouseEvent) {
		const href = findInternalLinkHref(event.target)
		if (href === null) return
		event.preventDefault()
		closeMore()
		navigate(href)
	}

	function handleToggleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			handleToggleCalendar()
		}
	}

	$effect(() => {
		if (!moreOpen) return
		// Capture-phase scroll catches scrolling on any ancestor (the editor
		// pane scrolls, not window).
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

<div class="journal-folder-header">
	{#if info.journalFolderTitle}
		<div class="journal-folder-header-folder-title">{info.journalFolderTitle}</div>
	{/if}

	<h1 class="journal-folder-header-title">{info.title}</h1>

	<div class="journal-folder-header-options">
		<div class="journal-folder-header-links">
			{#if info.backwardLink}
				<NoteLink
					{...info.backwardLink}
					linkStyle="chip"
					testId="nav-backward"
					{confirmCreate}
					{navigate}
				/>
				<div class="journal-folder-header-arrow">«</div>
			{/if}

			<div class="journal-folder-header-more" bind:this={moreWrapper}>
				<span
					class="internal-link journal-folder-note-link chip"
					class:open={moreOpen}
					role="button"
					tabindex="0"
					aria-haspopup="true"
					aria-expanded={moreOpen}
					data-jf-more-button
					onclick={toggleMore}
					onkeydown={handleMoreKeydown}
				>
					More...
				</span>
			</div>

			{#if info.todayLink}
				<NoteLink
					{...info.todayLink}
					linkStyle="chip"
					testId="nav-today"
					{confirmCreate}
					{navigate}
				/>
			{/if}

			{#if info.forwardLink}
				<div class="journal-folder-header-arrow">»</div>
				<NoteLink
					{...info.forwardLink}
					linkStyle="chip"
					testId="nav-forward"
					{confirmCreate}
					{navigate}
				/>
			{/if}
		</div>
	</div>

	{#if $calendarVisible}
		<JournalCalendar {note} {confirmCreate} {navigate} {isMobile} />
	{/if}
</div>

{#snippet calendarToggle()}
	<span
		class="journal-folder-calendar-toggle"
		class:active={$calendarVisible}
		role="button"
		tabindex="0"
		aria-pressed={$calendarVisible}
		data-jf-calendar-toggle
		onclick={handleToggleCalendar}
		onkeydown={handleToggleKeydown}
	>
		{$calendarVisible ? 'Hide calendar' : 'Show calendar'}
	</span>
{/snippet}

{#snippet section(label: string, links: typeof info.moreLinks, withToggle: boolean)}
	<div class="journal-folder-header-more-panel-section">
		<div class="journal-folder-header-more-panel-section-header">
			<div class="journal-folder-header-more-panel-section-label">{label}</div>
			{#if withToggle}{@render calendarToggle()}{/if}
		</div>
		<div class="journal-folder-header-more-panel-section-rule"></div>
		<div class="journal-folder-header-more-panel-list">
			{#each links as link}
				<NoteLink
					{...link}
					{confirmCreate}
					{navigate}
					onAfterClick={closeMore}
				/>
			{/each}
		</div>
	</div>
{/snippet}

{#if moreOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		use:portal
		bind:this={panelEl}
		class="journal-folder-header-more-panel"
		style={panelStyle}
		role="menu"
		data-jf-more-panel
		onclick={handlePanelClick}
	>
		{#if info.moreLinks.length > 0}
			{@render section(info.moreLinksLabel, info.moreLinks, true)}
		{/if}

		{#if info.secondaryLinks.length > 0}
			{@render section(
				info.secondaryLinksLabel,
				info.secondaryLinks,
				info.moreLinks.length === 0
			)}
		{/if}

		{#if info.extraLinks.length > 0}
			{@render section(
				info.extraLinksLabel,
				info.extraLinks,
				info.moreLinks.length === 0 && info.secondaryLinks.length === 0
			)}
		{/if}
	</div>
{/if}
