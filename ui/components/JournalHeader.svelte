<script lang="ts">
	import type {JournalHeaderState} from "../../features/journal-header-state";

	type Props = { state: JournalHeaderState }

	let {state}: Props = $props()
</script>

<h1>{state.title}</h1>

<div class="options">
	<div class="links">
		{#if state.backwardLink}
			<a class="internal-link center-link" href={state.backwardLink.url}>{state.backwardLink.title}</a>
			<div>&lt;--</div>
		{/if}
		{#each state.centerLinks as link}
			<a class="internal-link center-link" href={link.url}>{link.title}</a>
		{/each}
		{#if state.forwardLink}
			<div>--&gt;</div>
			<a class="internal-link center-link" href={state.forwardLink.url}>{state.forwardLink.title}</a>
		{/if}
	</div>

	{#if state.secondaryLinks.length > 0}
		<div class="links">
			{#each state.secondaryLinks as link, i}
				{#if i > 0}<div>|</div>{/if}
				<a class="internal-link" href={link.url}>{link.title}</a>
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

	.center-link {
		border: solid thin;
		display: block;
		line-height: 1rem;
		border-radius: .5rem;
		padding-inline: .5rem;
		height: fit-content;
		text-decoration: none;
	}

	.center-link:link, .center-link:visited, .center-link:hover, .center-link:active {
		text-decoration: none !important;
	}

	.center-link:hover {
		background: hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.2);
	}

	.center-link:active {
		color: var(--background-primary);
		background: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
	}
</style>
