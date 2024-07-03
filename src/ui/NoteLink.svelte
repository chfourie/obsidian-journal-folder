<script lang="ts">
	type LinkStyle = 'hyperlink' | 'chip'
	type Props = { title: string, url: string, inactive?: boolean, linkStyle?: LinkStyle }

	let { title, url, inactive = false, linkStyle = 'hyperlink' }: Props = $props()
</script>

{#if inactive}
	<span>{title}</span>
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

		&:link, &:visited, &:hover, &:active {
			text-decoration: none !important;
		}

		&:hover {
			background: hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.2);
		}

		&:active {
			color: var(--background-primary);
			background: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
		}
	}

	span {
		color: var(--text-faint)
	}
</style>
