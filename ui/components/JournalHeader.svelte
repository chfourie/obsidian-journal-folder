<script lang="ts">
	import type {JournalHeaderInfo} from "../../features/journal-header-info.type";

	type Props = { headerInfo: JournalHeaderInfo }

	let { headerInfo }: Props = $props()

	let linksOpen = $state(false)
</script>

<h1>{headerInfo.title}</h1>

<div class="options">
	<div class="links">
		<div>Mon, 24 Jun &lt;--</div>
		<div>(Y)</div>
		<div>(M)</div>
		<div>(W)</div>
		<div>(D)</div>
		<div>--&gt; Wed, 26 Jun</div>
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
		gap: .2em 1em;
		justify-content: center;
		flex-wrap: wrap;
	}

	.links > * {
		margin: 0;
	}
</style>
