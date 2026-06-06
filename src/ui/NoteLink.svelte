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
	type LinkStyle = 'hyperlink' | 'chip'
	type Props = {
		title: string
		url: string
		needsConfirmation?: boolean
		linkStyle?: LinkStyle
		// When provided, clicks on a `needsConfirmation` link route through
		// this prompt instead of Obsidian's default open-or-create flow. The
		// link still renders as `.is-unresolved` (Obsidian fades it via
		// `--link-unresolved-opacity`), so the user can still tell at a glance
		// that the note doesn't exist yet.
		confirmCreate?: (basename: string) => Promise<boolean>
		navigate?: (linktext: string) => void
		// Called after a click is fully resolved (confirmed-and-navigated, or
		// cancelled). The More panel uses this to close itself once the user
		// commits to or backs out of creating a past note.
		onAfterClick?: () => void
		// Stable hook for the e2e suite (rendered as `data-jf-id`). Has no
		// effect on behaviour or styling — purely a test selector.
		testId?: string
	}

	let {
		title,
		url,
		needsConfirmation = false,
		linkStyle = 'hyperlink',
		confirmCreate,
		navigate,
		onAfterClick,
		testId,
	}: Props = $props()

	async function handleClick(event: MouseEvent) {
		if (!needsConfirmation || !confirmCreate || !navigate) return
		// Past+missing notes prompt before being created. Block both default
		// navigation AND propagation so the panel-level delegation handler
		// doesn't double-fire `navigate` for the same click.
		event.preventDefault()
		event.stopPropagation()
		const basename = url.split('/').pop() ?? url
		const confirmed = await confirmCreate(basename)
		if (confirmed) navigate(url)
		onAfterClick?.()
	}
</script>

<a
	class="internal-link journal-folder-note-link"
	class:chip={linkStyle === 'chip'}
	class:is-unresolved={needsConfirmation}
	class:needs-confirmation={needsConfirmation}
	href={url}
	data-jf-id={testId}
	onclick={handleClick}
>{title}</a>
