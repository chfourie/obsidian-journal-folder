<script lang="ts">
	import type { JournalHeaderState } from './journal-header-state'
	import HeaderLink from './HeaderLink.svelte'

	type Props = { state: JournalHeaderState }

	let { state }: Props = $props()
</script>

<h1>{state.title}</h1>

<div class="options">
	<div class="links">
		{#if state.backwardLink}
			<HeaderLink link={state.backwardLink} />
			<div>&lt;--</div>
		{/if}
		{#each state.centerLinks as link}
			<HeaderLink {link} />
		{/each}
		{#if state.forwardLink}
			<div>--&gt;</div>
			<HeaderLink link={state.forwardLink} />
		{/if}
	</div>

	{#if state.secondaryLinks.length > 0}
		<div class="links">
			{#each state.secondaryLinks as link, i}
				{#if i > 0}
					<div>|</div>
				{/if}
				<HeaderLink {link} primary={false} />
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
