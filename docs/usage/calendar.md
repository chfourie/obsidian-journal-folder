# The calendar picker

Toggle the calendar from the More popover on any journal note and the inline picker appears below the header. It reflects the same exists/missing/today/current state the rest of the plugin uses, so you can see your whole journal at a glance:

![Calendar with three months visible](../screenshots/calendar-3-months.png)

## Cell rules

Apply uniformly across day, week, month, quarter, and year cells:

- **Missing** — theme's normal text colour, faded at the theme's unresolved-link opacity. Past missing cells are faded an additional 50% so they read as more demoted than future missing cells. Clicking a past missing cell opens a confirmation modal before creating the note (so you don't accidentally create back-dated entries).
- **Existing** — accent colour, bold, underlined.
- **Sundays** — accent colour across every state (existing, future-missing, past-missing) and on the weekday header, so the start of the week is always easy to pick out.
- **Today** — accent ring around the cell.
- **Current note** — filled accent background. Travels with the note's time unit, so opening a monthly note paints the *month* cell, not the day:

![Calendar viewed from a monthly note](../screenshots/calendar-from-monthly.png)

Clicking a date that doesn't yet have a note creates it (with a confirm prompt for past dates). Arrows on the sides slide the visible month window by one month at a time.

## Quick-nav strip

The strip above the months grid carries up to three quick-nav controls:

- **Year/Month** — always shown. Opens a date-picker popover with year chevrons (`‹` and `›` shift by ±12 months) and a 4×3 grid of month names; clicking a month jumps the window straight to it.
- **Current** — appears only when the visible window has scrolled away from today's month. Clicking it snaps back.
- **Note month** — appears only when the visible window has scrolled away from the host note's own month, and only differs from *Current* once you start a session on a non-today note.

Both *Current* and *Note month* hide themselves when they'd be redundant, so the chrome quietly disappears as you navigate back into range.

## Responsive layout

The number of visible months is chosen automatically based on the available width, capped at 5. As the pane narrows the picker drops to a single month; on mobile the cells additionally enlarge for easier tapping:

![Calendar at narrow width — single month layout](../screenshots/calendar-mobile.png)

## Default visibility

You can have the calendar open by default for new sessions — see `default-calendar-visible-desktop` and `default-calendar-visible-mobile` in the settings reference. The two platforms have independent defaults (calendar on for desktop, off for mobile) because the multi-month layout isn't useful at phone widths. A manual toggle from the More popover wins over any default for the rest of the running Obsidian session, so navigating between folders with different defaults won't override an explicit choice.
