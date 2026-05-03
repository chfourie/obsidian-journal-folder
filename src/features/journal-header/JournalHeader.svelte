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

	type Props = { info: JournalHeaderInfo }

	let { info }: Props = $props()

	let moreOpen = $state(false)
	let moreWrapper: HTMLElement | undefined = $state()

	function toggleMore() {
		moreOpen = !moreOpen
	}

	function closeMore() {
		moreOpen = false
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!moreOpen) return
		const target = event.target as Node | null
		if (target && moreWrapper && moreWrapper.contains(target)) return
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
</script>

<svelte:window onclick={handleDocumentClick} onkeydown={handleKeydown} />

<div class="journal-folder-header">
	{#if info.journalFolderTitle}
		<div class="journal-folder-header-folder-title">{info.journalFolderTitle}</div>
	{/if}

	<h1 class="journal-folder-header-title">{info.title}</h1>

	<div class="journal-folder-header-options">
		<div class="journal-folder-header-links">
			{#if info.backwardLink}
				<NoteLink {...info.backwardLink} linkStyle="chip" />
				<div>&lt;--</div>
			{/if}

			{#if info.moreLinks.length > 0 || info.secondaryLinks.length > 0}
				<div class="journal-folder-header-more" bind:this={moreWrapper}>
					<span
						class="internal-link journal-folder-note-link chip"
						class:open={moreOpen}
						role="button"
						tabindex="0"
						aria-haspopup="true"
						aria-expanded={moreOpen}
						onclick={toggleMore}
						onkeydown={handleMoreKeydown}
					>
						More...
					</span>

					{#if moreOpen}
						<div class="journal-folder-header-more-panel" role="menu">
							{#if info.moreLinks.length > 0}
								<div class="journal-folder-header-more-panel-section">
									<div class="journal-folder-header-more-panel-section-label">
										{info.moreLinksLabel}
									</div>
									<div class="journal-folder-header-more-panel-section-rule"></div>
									<div class="journal-folder-header-more-panel-list">
										{#each info.moreLinks as link}
											<NoteLink {...link} />
										{/each}
									</div>
								</div>
							{/if}

							{#if info.secondaryLinks.length > 0}
								<div class="journal-folder-header-more-panel-section">
									<div class="journal-folder-header-more-panel-section-label">
										{info.secondaryLinksLabel}
									</div>
									<div class="journal-folder-header-more-panel-section-rule"></div>
									<div class="journal-folder-header-more-panel-list">
										{#each info.secondaryLinks as link}
											<NoteLink {...link} />
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if info.todayLink}
				<NoteLink {...info.todayLink} linkStyle="chip" />
			{/if}

			{#if info.forwardLink}
				<div>--&gt;</div>
				<NoteLink {...info.forwardLink} linkStyle="chip" />
			{/if}
		</div>
	</div>
</div>
