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
	type Props = { title: string, url: string, inactive?: boolean, linkStyle?: LinkStyle }

	let { title, url, inactive = false, linkStyle = 'hyperlink' }: Props = $props()
</script>

{#if inactive}
	<span class="journal-folder-note-link no-link">{title}</span>
{:else}
	<a class="internal-link journal-folder-note-link" class:chip={linkStyle === 'chip'} href={url}>{title}</a>
{/if}
