# Auto-fill new journal notes

The plugin can seed new journal notes with a template body, so you don't need Templater (or another helper plugin) just to drop a `journal-header` code block at the top of every new note.

## Enabling

Off by default. Turn it on at any of two layers:

- **Globally** in *Settings → Community plugins → Journal Folder → Auto-fill new journal notes*.
- **Per folder** by adding `auto-template-enabled: true` (or `false` to disable) to that folder's `journal-folder.md` front matter. The easiest way is through the sidebar's **More... → Edit folder configuration** action.

When enabled, a new note is auto-filled only when **all** of these are true:

1. The note's basename matches a journal file pattern (`YYYY-MM-DD`, `gggg-[W]ww`, `YYYY-MM`, `YYYY-Q[1-4]` when quarters are enabled, or `YYYY`).
2. The folder containing the note has a `journal-folder.md` config file.
3. The note is empty at creation (existing content is never overwritten).

## One template, or one per note type?

A toggle in the plugin settings — *Use a different template per note type* — selects between the two modes. They are **mutually exclusive**: only one is in effect at a time.

- **Off** (default) — every new journal note (daily, weekly, monthly, quarterly, yearly) is seeded with the same *Default template*. The per-tier fields are hidden and ignored.
- **On** — pick a separate template for each note type via the *Daily / Weekly / Monthly / Quarterly / Yearly note template* fields. The generic *Default template* is hidden and ignored. A blank tier-specific field falls through to the built-in default rather than to the generic template.

The toggle is persisted as `auto-template-per-tier` and can be overridden per-folder in `journal-folder.md`.

## Template precedence

The template body is resolved in three layers, **first non-empty wins**:

1. **Per-folder body** — the markdown body of `journal-folder.md` (everything below its front matter). Use this when one folder needs a different template than the rest of the vault. Applies to every tier in that folder regardless of the toggle.
2. **Global setting** — depends on the toggle:
   - Toggle off: *Default template* (`auto-template-content`).
   - Toggle on: the matching *…note template* field for the new note's tier (`{daily,weekly,monthly,quarterly,yearly}-note-auto-template-content`).
3. **Built-in default** — `%% JOURNAL NOTE %%` followed immediately by an empty `journal-header` code block (no blank line between them, so the comment sits flush with the fence).

The `%% … %%` line is an Obsidian hidden comment — it doesn't render in reading mode and parks the cursor above the code block when toggling into edit mode. Without it, the cursor lands inside the fence and the block stops rendering until you click out.

## Different templates for different note types

Flip the *Use a different template per note type* toggle on (or set `auto-template-per-tier: true` per-folder) and the per-tier fields apply. For example, to give a folder a checklist for daily notes and a review prompt for weekly notes — while leaving monthly and yearly notes on the built-in default:

```markdown
---
auto-template-enabled: true
auto-template-per-tier: true
daily-note-auto-template-content: |
  %% JOURNAL NOTE %%
  ```journal-header
  ```

  ## Today's three priorities
  -
  -
  -

  ## Mood
weekly-note-auto-template-content: |
  %% JOURNAL NOTE %%
  ```journal-header
  ```

  ## Wins this week

  ## What to carry forward

  ## What to drop
---
```

When a tier-specific field is blank in this mode, the resolver falls through to the built-in default (the generic *Default template* is ignored while per-tier mode is on). The folder body (markdown below the front matter) still wins over every tier-specific field — leave it empty if you want the per-tier templates to be used.

## Per-folder template example

````markdown
---
journal-folder-title: Atlas Migration
auto-template-enabled: true
---

%% JOURNAL NOTE %%
```journal-header
```

## Highlights

## Notes
````

> [!TIP]
> If your template needs to contain a fenced code block (like the `journal-header` block above) and you want to wrap the *whole* template in another code block for clarity in `journal-folder.md`, use a tilde fence (`~~~`) for the outer wrapper or a longer run of backticks (4+) — anything longer than the inner fences. The plugin treats the entire body of `journal-folder.md` as the template, so wrapping isn't required; this only matters if you're showing the template to humans elsewhere.

## What the `journal-header` code block does in non-journal notes

The `journal-header` block is a no-op when placed in a note whose basename isn't a journal pattern. That means a template body containing the block stays harmless if it's pasted into `journal-folder.md` itself or any other regular note — it just renders nothing. Errors only show up if the block content is malformed config, not if the surrounding filename doesn't fit a journal pattern.
