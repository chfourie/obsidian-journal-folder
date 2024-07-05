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
	<span>{title}</span>
{:else}
	<a class="internal-link" class:chip={linkStyle === 'chip'} href={url}>{title}</a>
{/if}

<style>
	.chip {
		border: solid thin;
		display: block;
		line-height: 1rem;
		border-radius: .5rem;
		padding-inline: .5rem;
		height: fit-content;
		text-decoration: none;

		&:link, &:visited, &:hover, &:active {
			text-decoration: none !important;
		}

		&:hover {
			background: hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.2);
		}

		&:active {
			color: var(--background-primary);
			background: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
		}
	}

	span {
		color: var(--text-faint)
	}
</style>
