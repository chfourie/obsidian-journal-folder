# Signifiers (preview)

> [!WARNING]
> **Signifiers are a preview feature.** They're shipped as a working preview
> while the model settles — behaviour and settings keys may change between
> releases.

In a paper bullet journal, *signifiers* are little marks in the margin — a star
for something important, an exclamation for an idea — that let you scan a page
and find what matters without reading every line. This plugin brings the same
idea to your notes: bind an **icon** to a **tag**, and wherever that tag
appears the icon shows up in the left margin.

![Signifiers in the margin of a journal note](../screenshots/signifiers-reading.png)

Three signifiers ship by default:

| Signifier | Tag | Icon |
| --- | --- | --- |
| **Priority** | `#important` | ⭐ star |
| **Inspiration** | `#inspiration` | 💡 lightbulb |
| **Explore** | `#explore` | 👁 eye |

Signifiers apply to **any** rendered markdown — paragraphs, bullets, headings,
tasks — not just task lists. A line can carry several (just add several tags);
each gets its own icon, in the order you've configured them.

## Where the icon sits

The **Placement in notes** setting controls how the margin icons line up. Both
options hang the icon in the left margin (paper-journal style); they differ in
alignment:

- **Single column — all icons far-left** (the default) — every icon lines up in
  one column at the far left, no matter how deeply the line is nested. This is
  the classic left-rule look.
- **Per entry** — the icon hangs just left of each line, following its
  indentation, so nested items get nested markers.

The horizontal position is *measured* from your actual layout rather than
hard-coded, so the markers stay put across themes, CSS snippets, and
readable-line-width settings instead of colliding with restyled bullets or
checkboxes.

**Reserve left margin for gutter signifiers** (on by default) keeps a sliver of
space at the left edge so the icons never get clipped when readable line width
is off or the pane is narrow. Leave it on unless you have a specific reason not
to.

## Hiding the tag

By default the literal `#important` text is replaced by the icon so your notes
stay clean:

- **Hide tag in reading view** (on) — reading view shows only the icon.
- **Hide tag in live preview** (on) — the editor shows only the icon too, but
  the tag *reappears while your cursor is on it* so it stays editable.
- **Reveal tags on the active line** (off) — when on, putting the cursor
  anywhere on a line reveals all of that line's tags; when off, only the tag the
  cursor actually touches is revealed.

Turn the hide options off and the icon is shown *alongside* the tag instead of
replacing it.

In the plugin's own task lists (the sidebar panel and `journal-tasks` blocks)
the signifier icon always renders and the tag is always stripped from the
displayed text.

## Managing signifiers

Signifiers have their own tab: *Settings → Community plugins → Journal Folder →
Signifiers*. Add, reorder, and edit them there — each binds one or more tags to
an icon (any Lucide icon or an emoji) with an optional colour for Lucide icons.

![The Signifiers settings tab](../screenshots/settings-signifiers.png)

Signifiers are **global** — there's one shared set for the whole vault, not a
per-folder list.

### Tagging a line quickly

You don't have to type tags by hand. The command **"Modify signifiers on the
current line…"** (also on the editor right-click menu) opens a checklist of your
signifiers, pre-ticked with the ones already on the line. Tick or untick and
apply — the plugin adds or removes the matching tags for you and leaves the rest
of the line untouched.
