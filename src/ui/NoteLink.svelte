<script lang="ts">
	type LinkStyle = 'hyperlink' | 'chip'
	type Props = { title: string, url: string, inactive?: boolean, linkStyle?: LinkStyle }

	let { title, url, inactive = false, linkStyle = 'hyperlink' }: Props = $props()
</script>

{#if inactive}
	<span class="inactive">{title}</span>
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
	}

	.chip:link, .chip:visited, .chip:hover, .chip:active {
		text-decoration: none !important;
	}

	.chip:hover {
		background: hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.2);
	}

	.chip:active {
		color: var(--background-primary);
		background: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
	}

	.inactive {
		color: var(--text-faint)
	}
</style>
