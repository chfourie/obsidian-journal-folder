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
</script>

<h1>{info.title}</h1>

<div class="options">
	<div class="links">
		{#if info.backwardLink}
			<NoteLink {...info.backwardLink} linkStyle="chip" />
			<div>&lt;--</div>
		{/if}
		{#each info.centerLinks as link}
			<NoteLink {...link} linkStyle="chip" />
		{/each}
		{#if info.forwardLink}
			<div>--&gt;</div>
			<NoteLink {...info.forwardLink} linkStyle="chip" />
		{/if}
	</div>

	{#if info.secondaryLinks.length > 0}
		<div class="links">
			{#each info.secondaryLinks as link, i}
				{#if i > 0}
					<div>|</div>
				{/if}
				<NoteLink {...link} />
			{/each}
		</div>
	{/if}
</div>

<style>
	h1 {
		width: fit-content;
		margin-inline: auto;
		margin-bottom: 0.2rem;
	}

	.options {
		font-size: .9rem;
		padding: .2rem 0;
		gap: .2rem;
		border-block: solid var(--border-width) var(--hr-color);
		display: flex;
		flex-direction: column;
		margin-bottom: 1rem;
	}

	.links {
		display: flex;
		gap: .2rem .3rem;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
	}

	.links > * {
		margin: 0;
	}
</style>
