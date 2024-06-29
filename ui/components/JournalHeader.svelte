<script lang="ts">
	import type {JournalFile} from "../../features/journal-file";

	type Props = { file: JournalFile }

	let {file}: Props = $props()
</script>

<h1>{file.title}</h1>

<div class="options">
	<div class="links">

		{#if file.backwardLink}
			<a class="internal-link center-link" href={file.backwardLink.url}>{file.backwardLink.title}</a>
			<div>&lt;--</div>
		{/if}
		{#each file.centerLinks as link}
			<a class="internal-link center-link" href={link.url}>{link.title}</a>
		{/each}
		{#if file.forwardLink}
			<div>--&gt;</div>
			<a class="internal-link center-link" href={file.forwardLink.url}>{file.forwardLink.title}</a>
		{/if}
	</div>
</div>

<style>
	h1 {
		width: fit-content;
		margin-inline: auto;
		margin-bottom: 0.2rem;

	}

	.options {
		font-size: .8rem;
		padding: .2rem 0;
		gap: .2rem;
		border-block: solid var(--border-width) var(--hr-color);
		display: flex;
		flex-direction: column;
		margin-bottom: 1rem;
	}

	.links {
		display: flex;
		gap: .2rem .5rem;
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
		line-height: 1.2rem;
		border-radius: .6rem;
		padding-inline: .6rem;
		height: fit-content;
	}

	.center-link:link {
		text-decoration: none;
	}
</style>
