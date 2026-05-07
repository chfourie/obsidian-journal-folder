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
    showCurrent: boolean
    showNoteMonth: boolean
    onCurrent: () => void
    onNoteMonth: () => void
  }

  const {
    note,
    offsetMonths,
    confirmCreate,
    navigate,
    onPrev,
    onNext,
    showCurrent,
    showNoteMonth,
    onCurrent,
    onNoteMonth,
  }: Props = $props()

  const info = $derived(
    buildCalendarInfo(note, { visibleMonthCount: 1, offsetMonths })
  )
  const month = $derived(info.months[0])

  async function handleCellClick(cell: CalendarCell, event: MouseEvent) {
    // Always intercept — Obsidian's `internal-link` click interception
    // only fires inside markdown-rendered containers; an ItemView like
    // the sidebar is outside that scope, so we have to call
    // `openLinkText` ourselves. Without this, today's and future cells
    // (which set `needsConfirmation: false`) silently do nothing.
    event.preventDefault()
    event.stopPropagation()
    if (cell.needsConfirmation) {
      const basename = cell.url.split('/').pop() ?? cell.url
      if (!(await confirmCreate(basename))) return
    }
    navigate(cell.url)
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
    <span class="jf-sidebar-calendar-title">
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

  {#if showCurrent || showNoteMonth}
    <div class="jf-sidebar-calendar-jump-links">
      {#if showCurrent}
        <span
          class="jf-sidebar-link"
          role="button"
          tabindex="0"
          aria-label="Jump to today's month"
          onclick={onCurrent}
          onkeydown={onKey(onCurrent)}
        >
          Current
        </span>
      {/if}
      {#if showNoteMonth}
        <span
          class="jf-sidebar-link"
          role="button"
          tabindex="0"
          aria-label="Jump to the active note's month"
          onclick={onNoteMonth}
          onkeydown={onKey(onNoteMonth)}
        >
          Note month
        </span>
      {/if}
    </div>
  {/if}

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
