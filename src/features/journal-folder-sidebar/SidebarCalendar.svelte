<!--
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import type { JournalNote } from '../../data-access'
  import {
    buildCalendarInfo,
    type CalendarCell,
  } from '../journal-header/journal-calendar-info'
  import { calendarCellClasses } from '../journal-header/calendar-cell-classes'

  type Props = {
    note: JournalNote
    offsetMonths: number
    confirmCreate: (basename: string) => Promise<boolean>
    navigate: (url: string) => void
    onPrev: () => void
    onNext: () => void
    onToday: () => void
  }

  const {
    note,
    offsetMonths,
    confirmCreate,
    navigate,
    onPrev,
    onNext,
    onToday,
  }: Props = $props()

  const info = $derived(
    buildCalendarInfo(note, { visibleMonthCount: 1, offsetMonths })
  )
  const month = $derived(info.months[0])

  async function handleCellClick(cell: CalendarCell, event: MouseEvent) {
    if (!cell.needsConfirmation) return
    event.preventDefault()
    event.stopPropagation()
    const basename = cell.url.split('/').pop() ?? cell.url
    if (await confirmCreate(basename)) navigate(cell.url)
  }

  function onKey(action: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        action()
      }
    }
  }
</script>

<div class="jf-sidebar-calendar">
  <div class="jf-sidebar-calendar-controls">
    <button
      type="button"
      class="clickable-icon jf-sidebar-calendar-arrow"
      aria-label="Previous month"
      onclick={onPrev}
    >
      ‹
    </button>
    <span
      class="jf-sidebar-calendar-title"
      role="button"
      tabindex="0"
      aria-label="Jump to today"
      onclick={onToday}
      onkeydown={onKey(onToday)}
      title="Click to jump to today"
    >
      {month.monthCell.label} {month.yearCell.label}{#if month.quarterCell}
        <span class="jf-sidebar-calendar-quarter">({month.quarterCell.label})</span>
      {/if}
    </span>
    <button
      type="button"
      class="clickable-icon jf-sidebar-calendar-arrow"
      aria-label="Next month"
      onclick={onNext}
    >
      ›
    </button>
  </div>

  <div class="journal-folder-calendar-month jf-sidebar-calendar-month">
    {#key month.monthIso}
      {@const renderedWeekCount = month.weeks.filter(
        (w) => !w.days.every((d) => d.isOutsideMonth)
      ).length}
      <div
        class="journal-folder-calendar-grid"
        style="grid-template-rows: repeat({renderedWeekCount + 1}, auto)"
      >
        <div class="journal-folder-calendar-divider" aria-hidden="true"></div>
        <div class="journal-folder-calendar-weekday">W</div>
        {#each month.weekdayHeaders as header}
          <div
            class="journal-folder-calendar-weekday"
            class:is-sunday={header.isSunday}
          >{header.label}</div>
        {/each}

        {#each month.weeks as week}
          {#if !week.days.every((d) => d.isOutsideMonth)}
            <a
              class="internal-link {calendarCellClasses(week.weekCell)} week"
              href={week.weekCell.url}
              onclick={(e) => handleCellClick(week.weekCell, e)}
            >
              {week.weekCell.label}
            </a>
            {#each week.days as day}
              {#if day.isOutsideMonth}
                <div class="journal-folder-calendar-cell empty" aria-hidden="true"></div>
              {:else}
                <a
                  class="internal-link {calendarCellClasses(day)} day"
                  href={day.url}
                  onclick={(e) => handleCellClick(day, e)}
                >
                  {day.label}
                </a>
              {/if}
            {/each}
          {/if}
        {/each}
      </div>
    {/key}
  </div>
</div>
