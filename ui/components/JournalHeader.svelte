<script lang="ts">
	import type {JournalFile} from "../../features/journal-file";

	type Props = { file: JournalFile }

	let {file}: Props = $props()

	let linksOpen = $state(false)
</script>

<h1>{file.title}</h1>

<div class="options">
	<div class="links">

		<div>Mon, 24 Jun</div>
		<div>&lt;--</div>
		{#each file.centerLinks as link}
			<a class="internal-link center-link" href={link.url}>{link.title}</a>
		{/each}
		<div>--&gt;</div>
		<div>Wed, 26 Jun</div>
	</div>
</div>

<style>
	h1 {
		width: fit-content;
		margin-inline: auto;
		margin-bottom: 0.2em;

	}

	.options {
		padding: .2em 0;
		gap: .2em;
		border-block: solid var(--border-width) var(--hr-color);
		display: flex;
		flex-direction: column;
		margin-bottom: 1em;
	}

	.links {
		display: flex;
		gap: .2em .5em;
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
