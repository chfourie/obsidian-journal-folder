<script lang="ts">
	import type { JournalHeaderState } from './journal-header-state'
	import { NoteLink } from '@journal-folder/ui'

	type Props = { state: JournalHeaderState }

	let { state }: Props = $props()
</script>

<h1>{state.title}</h1>

<div class="options">
	<div class="links">
		{#if state.backwardLink}
			<NoteLink link={state.backwardLink} linkStyle="chip" />
			<div>&lt;--</div>
		{/if}
		{#each state.centerLinks as link}
			<NoteLink {link} linkStyle="chip" />
		{/each}
		{#if state.forwardLink}
			<div>--&gt;</div>
			<NoteLink link={state.forwardLink} linkStyle="chip" />
		{/if}
	</div>

	{#if state.secondaryLinks.length > 0}
		<div class="links">
			{#each state.secondaryLinks as link, i}
				{#if i > 0}
					<div>|</div>
				{/if}
				<NoteLink {link} />
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
