<script lang="ts">

	import { type Link } from '@journal-folder/data-access'

	type LinkStyle = 'hyperlink' | 'chip'
	type Props = { link: Link, linkStyle?: LinkStyle }

	let { link, linkStyle = 'hyperlink' }: Props = $props()
</script>

{#if link.inactive}
	<span class="inactive">{link.title}</span>
{:else}
	<a class="internal-link" class:chip={linkStyle === 'chip'} href={link.url}>{link.title}</a>
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
