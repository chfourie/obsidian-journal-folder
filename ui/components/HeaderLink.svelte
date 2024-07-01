<script lang="ts">
	import type { HeaderLink } from '../../features/header-link.type'

	type Props = { link: HeaderLink, primary?: boolean }

	let { link, primary = true }: Props = $props()
</script>

{#if link.inactive}
	<span class="inactive">{link.title}</span>
{:else}
	<a class="internal-link" class:primary={primary} href={link.url}>{link.title}</a>
{/if}

<style>
	.primary {
		border: solid thin;
		display: block;
		line-height: 1rem;
		border-radius: .5rem;
		padding-inline: .5rem;
		height: fit-content;
		text-decoration: none;
	}

	.primary:link, .primary:visited, .primary:hover, .primary:active {
		text-decoration: none !important;
	}

	.primary:hover {
		background: hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.2);
	}

	.primary:active {
		color: var(--background-primary);
		background: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
	}

	.inactive {
		color: var(--text-faint)
	}
</style>
