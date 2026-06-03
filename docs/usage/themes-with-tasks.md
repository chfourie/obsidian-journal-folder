# Using with a theme that styles tasks

Several popular Obsidian themes — **Minimal**, **Things**, **AnuPpuccin**, **Border**, and others — ship custom checkbox styling that recognises the community-conventional alphabet (`[ ]`, `[/]`, `[x]`, `[>]`, `[-]`, sometimes `[d]` / `[?]`). Journal Folder is designed to coexist with these themes; you can pick per-status which side draws the checkbox.

## The two rendering modes

Every status in a task flow has a **rendering** field:

- **`theme`** — the plugin emits Obsidian's native `<input type="checkbox" data-task="…">` element and lets the active theme's CSS do the styling. This is the right choice for any status whose character your theme already handles.
- **`plugin`** — the plugin paints a custom shell (shape, background, border, colour) and inner glyph (Lucide icon, emoji, image URL, or sanitised inline SVG). This is the right choice for statuses your theme doesn't know about, or when you want a specific look regardless of theme.

The choice is **per-status**, not per-flow — a single flow can mix theme-styled and plugin-painted rows. That's exactly what you want when a theme supports `[ ]` `[/]` `[x]` but not your custom `[d]` / `[?]`: leave the supported chars on `theme`, let the plugin paint the rest.

The rendering field lives in *Settings → Community plugins → Journal Folder → Tasks → \<flow\> → \<status\> → Basics*.

## Recommended starting point

1. Apply the built-in template that matches your workflow as a starting flow (Simple / Kanban / Bullet Journal / GTD).
2. Switch each status's *Rendering* to **theme** if your theme already styles its character.
3. Leave statuses your theme doesn't recognise on **plugin** rendering and pick a shell + icon that fits.

## Scope of interaction

If you only want the plugin's task surfaces (sidebar panel, `journal-tasks` blocks) to use your configured rendering — and want document-body checkboxes left entirely to Obsidian / your theme — leave **`task-interaction-scope`** on its default value of **`lists`**. This is the default for fresh installs and is the safest mode when you're relying on a theme to drive visuals.

If you'd rather have the plugin's rendering apply uniformly to every task checkbox in the vault (so the configured plugin-painted shells appear in regular notes too, not just journal surfaces), switch the scope to **`everywhere`**. Note that this competes with theme CSS — anywhere you've set a status to `plugin` rendering, the theme's checkbox styling for that character will be overridden by the plugin's shell.

## Caveats

- **Custom characters your theme doesn't know about** render as plain checkboxes in theme-styled documents. The plugin's own surfaces (sidebar, `journal-tasks` blocks) stay accurate either way.
- **Theme CSS targeting `input[type="checkbox"]`** only applies to statuses with `rendering: theme`. Plugin-painted rows are real DOM `<span>` shells and won't be touched by checkbox-selector CSS.
- **`is-checked` class.** Some themes change their styling based on Obsidian's `is-checked` class, which is only added to native checkboxes whose status is `[x]`. For other "done" characters (`[>]`, `[-]`), the plugin still treats them as done for filtering but the theme may not.
