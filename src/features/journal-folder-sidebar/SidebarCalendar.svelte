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
  import {
    anchorMonth,
    monthOptions,
    offsetForTarget,
  } from '../journal-header/calendar-navigation'

  type Props = {
    note: JournalNote
    offsetMonths: number
    confirmCreate: (basename: string) => Promise<boolean>
    navigate: (url: string) => void
    onPrev: () => void
    onNext: () => void
    setOffsetMonths: (offset: number) => void
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
    setOffsetMonths,
    showCurrent,
    showNoteMonth,
    onCurrent,
    onNoteMonth,
  }: Props = $props()

  const info = $derived(
    buildCalendarInfo(note, { visibleMonthCount: 1, offsetMonths })
  )
  const month = $derived(info.months[0])

  // Year/month picker — same shape as the in-note JournalCalendar's: a
  // small portaled popover with year `‹ … ›` chevrons and a 4×3 month
  // grid. Portaled to <body> for parity with the in-note pattern (the
  // sidebar's own viewport is narrow enough that the picker can extend
  // past the column edge without being clipped).
  const months = monthOptions()
  const centeredAnchor = $derived(anchorMonth(note.getMoment(), offsetMonths))
  let pickerOpen = $state(false)
  let pickerTriggerEl: HTMLElement | undefined = $state()
  let pickerEl: HTMLElement | undefined = $state()
  let pickerStyle = $state('')

  function portal(node: HTMLElement) {
    activeDocument.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function updatePickerPosition() {
    if (!pickerTriggerEl) return
    const rect = pickerTriggerEl.getBoundingClientRect()
    const gap = 6
    const top = rect.bottom + gap
    const centerX = rect.left + rect.width / 2
    if (!pickerEl) {
      pickerStyle = `top: ${top}px; left: ${centerX}px; transform: translateX(-50%);`
      return
    }
    const margin = 8
    const pickerWidth = pickerEl.getBoundingClientRect().width
    let leftPx = centerX - pickerWidth / 2
    leftPx = Math.max(
      margin,
      Math.min(activeWindow.innerWidth - pickerWidth - margin, leftPx)
    )
    pickerStyle = `top: ${top}px; left: ${leftPx}px;`
  }

  function togglePicker() {
    pickerOpen = !pickerOpen
    if (pickerOpen) window.requestAnimationFrame(updatePickerPosition)
  }

  function closePicker() {
    pickerOpen = false
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!pickerOpen) return
    const target = event.target as Node | null
    if (target && pickerTriggerEl && pickerTriggerEl.contains(target)) return
    if (target && pickerEl && pickerEl.contains(target)) return
    closePicker()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (pickerOpen && event.key === 'Escape') closePicker()
  }

  function handleViewportChange() {
    if (pickerOpen) updatePickerPosition()
  }

  $effect(() => {
    if (!pickerOpen) return
    activeDocument.addEventListener('scroll', handleViewportChange, true)
    return () =>
      activeDocument.removeEventListener('scroll', handleViewportChange, true)
  })

  function prevYear() {
    setOffsetMonths(offsetMonths - 12)
  }
  function nextYear() {
    setOffsetMonths(offsetMonths + 12)
  }
  function selectMonth(value: number) {
    setOffsetMonths(
      offsetForTarget(note.getMoment(), centeredAnchor.year, value)
    )
    closePicker()
  }

  // Cell clicks must always intercept in the sidebar — Obsidian's
  // built-in `internal-link` click delegation only fires inside markdown
  // containers, and the sidebar is an ItemView outside that scope. Pass
  // through to the supplied `navigate` (which calls `openLinkText`) for
  // every cell, gating the confirmation modal on `needsConfirmation`.
  async function handleCellClick(cell: CalendarCell, event: MouseEvent) {
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

  // Basename of a cell's linktext, exposed as `data-jf-date` for the e2e suite.
  function cellDate(cell: CalendarCell): string {
    return cell.url.split('/').pop() ?? cell.url
  }
</script>

<div class="jf-sidebar-calendar journal-folder-calendar" data-jf-sidebar-calendar>
  <button
    type="button"
    class="clickable-icon journal-folder-calendar-arrow"
    aria-label="Previous month"
    data-jf-nav="prev"
    onclick={onPrev}
  >
    ‹
  </button>

  <div class="journal-folder-calendar-body">
    <div class="journal-folder-calendar-controls">
      <span
        class="journal-folder-calendar-link"
        class:open={pickerOpen}
        role="button"
        tabindex="0"
        bind:this={pickerTriggerEl}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        data-jf-picker-trigger
        onclick={togglePicker}
        onkeydown={onKey(togglePicker)}
      >
        Year/Month
      </span>
      {#if showCurrent}
        <span
          class="journal-folder-calendar-link"
          role="button"
          tabindex="0"
          aria-label="Jump to today's month"
          data-jf-quick-jump="today"
          onclick={onCurrent}
          onkeydown={onKey(onCurrent)}
        >
          Current
        </span>
      {/if}
      {#if showNoteMonth}
        <span
          class="journal-folder-calendar-link"
          role="button"
          tabindex="0"
          aria-label="Jump to the active note's month"
          data-jf-quick-jump="note-month"
          onclick={onNoteMonth}
          onkeydown={onKey(onNoteMonth)}
        >
          Note month
        </span>
      {/if}
    </div>

    <div class="journal-folder-calendar-months">
      {#key month.monthIso}
        {@const renderedWeekCount = month.weeks.filter(
          (w) => !w.days.every((d) => d.isOutsideMonth)
        ).length}
        <div class="journal-folder-calendar-month">
          <div class="journal-folder-calendar-month-title">
            <a
              class="internal-link {calendarCellClasses(month.monthCell)}"
              href={month.monthCell.url}
              data-jf-cell="month"
              data-jf-date={cellDate(month.monthCell)}
              onclick={(e) => handleCellClick(month.monthCell, e)}
            >
              {month.monthCell.label}
            </a>
            <a
              class="internal-link {calendarCellClasses(month.yearCell)}"
              href={month.yearCell.url}
              data-jf-cell="year"
              data-jf-date={cellDate(month.yearCell)}
              onclick={(e) => handleCellClick(month.yearCell, e)}
            >
              {month.yearCell.label}
            </a>
            {#if month.quarterCell}
              <a
                class="internal-link {calendarCellClasses(month.quarterCell)} quarter-suffix"
                href={month.quarterCell.url}
                data-jf-cell="quarter"
                data-jf-date={cellDate(month.quarterCell)}
                onclick={(e) => handleCellClick(month.quarterCell!, e)}
              >
                ({month.quarterCell.label})
              </a>
            {/if}
          </div>

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
                  data-jf-cell="week"
                  data-jf-date={cellDate(week.weekCell)}
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
                      data-jf-cell="day"
                      data-jf-date={cellDate(day)}
                      onclick={(e) => handleCellClick(day, e)}
                    >
                      {day.label}
                    </a>
                  {/if}
                {/each}
              {/if}
            {/each}
          </div>
        </div>
      {/key}
    </div>
  </div>

  <button
    type="button"
    class="clickable-icon journal-folder-calendar-arrow"
    aria-label="Next month"
    data-jf-nav="next"
    onclick={onNext}
  >
    ›
  </button>
</div>

<svelte:window onclick={handleDocumentClick} onkeydown={handleKeydown} onresize={handleViewportChange} />

{#if pickerOpen}
  <div
    use:portal
    bind:this={pickerEl}
    class="journal-folder-calendar-picker"
    style={pickerStyle}
    role="dialog"
    aria-label="Pick a month and year"
    data-jf-date-picker
  >
    <div class="journal-folder-calendar-picker-year">
      <button
        type="button"
        class="clickable-icon journal-folder-calendar-picker-year-arrow"
        aria-label="Previous year"
        onclick={prevYear}
      >
        ‹
      </button>
      <span class="journal-folder-calendar-picker-year-label">
        {centeredAnchor.year}
      </span>
      <button
        type="button"
        class="clickable-icon journal-folder-calendar-picker-year-arrow"
        aria-label="Next year"
        onclick={nextYear}
      >
        ›
      </button>
    </div>
    <div class="journal-folder-calendar-picker-months">
      {#each months as m (m.value)}
        <span
          class="journal-folder-calendar-picker-month"
          class:active={m.value === centeredAnchor.month}
          role="button"
          tabindex="0"
          data-jf-month-select={m.value}
          onclick={() => selectMonth(m.value)}
          onkeydown={onKey(() => selectMonth(m.value))}
        >
          {m.label}
        </span>
      {/each}
    </div>
  </div>
{/if}
