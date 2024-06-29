<script lang="ts">
	import type {JournalFile} from "features/journal-file";

	type Props = { file: JournalFile }

	let {file}: Props = $props()

	let linksOpen = $state(false)
</script>

<h1>{file.title}</h1>

<div class="options">
	<div class="links">

		<div>Mon, 24 Jun</div>
		<div>&lt;--</div>
		{#each file.headerCenterLinks as link}
			<a class="internal-link center-link" href={link.url}>{link.title}</a>
		{/each}
		<div>--&gt;</div>
		<div>Wed, 26 Jun</div>
		<button onclick={() => linksOpen = !linksOpen}>Toggle Links</button>
	</div>


	{#if linksOpen}
		<div class="links">
			<div class="prev-next">
				<a href="Journal/Daily/2024-06-21">Monday</a> |
				<a href="Journal/Daily/2024-06-21">Thursday</a> |
				<a href="Journal/Daily/2024-06-21">2024</a> |
				<a href="Journal/Daily/2024-06-21">June</a> |
				<a href="Journal/Daily/2024-06-21">Week 25</a> |
				<a href="Journal/Daily/2024-06-21">Saturday</a>
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		width: fit-content;
		margin: auto;
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
