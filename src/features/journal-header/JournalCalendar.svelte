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
	import { moment } from '../../data-access'
	import type { JournalNote } from '../../data-access'
	import {
		buildCalendarInfo,
		type CalendarCell,
	} from './journal-calendar-info'
	import { calendarCellClasses } from './calendar-cell-classes'
	import { pickVisibleMonthCount } from './visible-month-count'
	import {
		anchorMonth,
		monthOptions,
		offsetForTarget,
		shouldShowCurrentLink,
		shouldShowNoteMonthLink,
		todayAnchor,
	} from './calendar-navigation'

	type Props = {
		note: JournalNote
		confirmCreate: (basename: string) => Promise<boolean>
		navigate: (linktext: string) => void
		// Display-only override: when set every cell links to this URL (the
		// template file itself) so a template preview's calendar doesn't
		// navigate to real journal notes. `cellDate` still reports the real
		// period so the e2e `data-jf-date` hooks stay meaningful.
		navOverrideUrl?: string
		isMobile: boolean
	}
	let { note, confirmCreate, navigate, navOverrideUrl, isMobile }: Props =
		$props()

	// The href a cell should carry — its real link, or the display-only self
	// target in template-preview mode.
	function cellHref(cell: CalendarCell): string {
		return navOverrideUrl ?? cell.url
	}

	let containerEl: HTMLElement | undefined = $state()
	let measuredWidth = $state(0)
	let offsetMonths = $state(0)

	let visibleMonthCount = $derived(
		pickVisibleMonthCount(measuredWidth, { isMobile })
	)

	let info = $derived(
		buildCalendarInfo(note, { visibleMonthCount, offsetMonths })
	)

	const months = monthOptions()
	let centeredAnchor = $derived(anchorMonth(note.getMoment(), offsetMonths))
	let centeredMonthLabel = $derived(months[centeredAnchor.month].label)
	// `Current` and `Note month` quick-jumps. The note's month is at
	// offset 0 by definition; today's month is wherever today's calendar
	// currently sits relative to the note's anchor.
	let noteMonthAnchor = $derived(anchorMonth(note.getMoment(), 0))
	let todayMonthAnchor = $derived(todayAnchor())
	let showCurrent = $derived(
		shouldShowCurrentLink(centeredAnchor, todayMonthAnchor)
	)
	let showNoteMonth = $derived(
		shouldShowNoteMonthLink(centeredAnchor, noteMonthAnchor, todayMonthAnchor)
	)

	// Date-picker popover state. The picker is portaled to <body> for the
	// same reason the More popover is — CodeMirror live-preview widgets clip
	// absolutely-positioned descendants.
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
		const triggerRect = pickerTriggerEl.getBoundingClientRect()
		const gap = 6
		const top = triggerRect.bottom + gap
		const centerX = triggerRect.left + triggerRect.width / 2

		// On the very first call after toggleOpen, `pickerEl` is bound but
		// not yet measurable in the same tick. Use a transform-based centre
		// as a fallback; the rAF/scroll/resize re-runs measure properly.
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
		// Capture-phase scroll catches the editor pane (which scrolls
		// independently of the window).
		activeDocument.addEventListener('scroll', handleViewportChange, true)
		return () =>
			activeDocument.removeEventListener('scroll', handleViewportChange, true)
	})

	$effect(() => {
		if (!containerEl) return
		const update = () => {
			measuredWidth = containerEl!.clientWidth
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(containerEl)
		return () => observer.disconnect()
	})

	// Navigating to a different file remounts this component (new `note`),
	// so resetting offset isn't needed across notes — only when the visible
	// count changes, snap back to centre so the current month stays in view.
	let lastCount = $state(0)
	$effect(() => {
		if (visibleMonthCount !== lastCount) {
			lastCount = visibleMonthCount
			offsetMonths = 0
		}
	})

	function scrollBack() {
		offsetMonths -= 1
	}

	function scrollForward() {
		offsetMonths += 1
	}

	function scrollToToday() {
		const today = moment()
		offsetMonths = offsetForTarget(
			note.getMoment(),
			today.year(),
			today.month()
		)
	}

	function scrollToNoteMonth() {
		offsetMonths = 0
	}

	function prevYear() {
		offsetMonths -= 12
	}

	function nextYear() {
		offsetMonths += 12
	}

	function selectMonth(value: number) {
		offsetMonths = offsetForTarget(
			note.getMoment(),
			centeredAnchor.year,
			value
		)
		closePicker()
	}

	// Activate-on-key handler factory so each link-styled <span> can be
	// reached and triggered with Enter/Space the way a real <button> would.
	// We use spans rather than <button>s because Obsidian's stylesheet
	// repaints native buttons with a filled chip background — switching
	// elements is the simplest way to opt out completely.
	function onKey(action: () => void) {
		return (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault()
				action()
			}
		}
	}

	// The basename portion of a cell's linktext (e.g. `2026-06-07`), exposed as
	// `data-jf-date` so the e2e suite can target a specific period cell.
	function cellDate(cell: CalendarCell): string {
		return cell.url.split('/').pop() ?? cell.url
	}

	async function handleCellClick(cell: CalendarCell, event: MouseEvent) {
		if (!cell.needsConfirmation) return
		// Always block the default internal-link navigation; the modal is
		// async, so we navigate manually after the user confirms.
		event.preventDefault()
		event.stopPropagation()
		const basename = cell.url.split('/').pop() ?? cell.url
		if (await confirmCreate(basename)) navigate(cell.url)
	}
</script>

<div
	class="journal-folder-calendar"
	class:is-mobile={isMobile}
	bind:this={containerEl}
>
	<button
		type="button"
		class="clickable-icon journal-folder-calendar-arrow"
		aria-label="Show earlier months"
		data-jf-nav="prev"
		onclick={scrollBack}
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
				aria-label="Year/Month picker — currently {centeredMonthLabel} {centeredAnchor.year}"
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
					onclick={scrollToToday}
					onkeydown={onKey(scrollToToday)}
				>
					Current
				</span>
			{/if}
			{#if showNoteMonth}
				<span
					class="journal-folder-calendar-link"
					role="button"
					tabindex="0"
					aria-label="Jump to this note's month"
					data-jf-quick-jump="note-month"
					onclick={scrollToNoteMonth}
					onkeydown={onKey(scrollToNoteMonth)}
				>
					Note month
				</span>
			{/if}
		</div>

		<div class="journal-folder-calendar-months">
		{#each info.months as month (month.monthIso)}
			{@const renderedWeekCount = month.weeks.filter(
				(w) => !w.days.every((d) => d.isOutsideMonth)
			).length}
			<div class="journal-folder-calendar-month">
				<div class="journal-folder-calendar-month-title">
					<a
						class="internal-link {calendarCellClasses(month.monthCell)}"
						href={cellHref(month.monthCell)}
						data-jf-cell="month"
						data-jf-date={cellDate(month.monthCell)}
						onclick={(e) => handleCellClick(month.monthCell, e)}
					>
						{month.monthCell.label}
					</a>
					<a
						class="internal-link {calendarCellClasses(month.yearCell)}"
						href={cellHref(month.yearCell)}
						data-jf-cell="year"
						data-jf-date={cellDate(month.yearCell)}
						onclick={(e) => handleCellClick(month.yearCell, e)}
					>
						{month.yearCell.label}
					</a>
					{#if month.quarterCell}
						<a
							class="internal-link {calendarCellClasses(month.quarterCell)} quarter-suffix"
							href={cellHref(month.quarterCell)}
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
								href={cellHref(week.weekCell)}
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
										href={cellHref(day)}
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
		{/each}
		</div>
	</div>

	<button
		type="button"
		class="clickable-icon journal-folder-calendar-arrow"
		aria-label="Show later months"
		data-jf-nav="next"
		onclick={scrollForward}
	>
		›
	</button>
</div>

<svelte:window
	onclick={handleDocumentClick}
	onkeydown={handleKeydown}
	onresize={handleViewportChange}
/>

{#if pickerOpen}
	<div
		use:portal
		bind:this={pickerEl}
		class="journal-folder-calendar-picker"
		class:is-mobile={isMobile}
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
