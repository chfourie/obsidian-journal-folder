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
	} from './journal-calendar-info'
	import { calendarCellClasses } from './calendar-cell-classes'
	import { pickVisibleMonthCount } from './visible-month-count'

	type Props = {
		note: JournalNote
		confirmCreate: (basename: string) => Promise<boolean>
		navigate: (linktext: string) => void
		isMobile: boolean
	}
	let { note, confirmCreate, navigate, isMobile }: Props = $props()

	let containerEl: HTMLElement | undefined = $state()
	let measuredWidth = $state(0)
	let offsetMonths = $state(0)

	let visibleMonthCount = $derived(
		pickVisibleMonthCount(measuredWidth, { isMobile })
	)

	let info = $derived(
		buildCalendarInfo(note, { visibleMonthCount, offsetMonths })
	)

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
		onclick={scrollBack}
	>
		‹
	</button>

	<div class="journal-folder-calendar-months">
		{#each info.months as month (month.monthIso)}
			{@const renderedWeekCount = month.weeks.filter(
				(w) => !w.days.every((d) => d.isOutsideMonth)
			).length}
			<div class="journal-folder-calendar-month">
				<div class="journal-folder-calendar-month-title">
					<a
						class="internal-link {calendarCellClasses(month.monthCell)}"
						href={month.monthCell.url}
						onclick={(e) => handleCellClick(month.monthCell, e)}
					>
						{month.monthCell.label}
					</a>
					<a
						class="internal-link {calendarCellClasses(month.yearCell)}"
						href={month.yearCell.url}
						onclick={(e) => handleCellClick(month.yearCell, e)}
					>
						{month.yearCell.label}
					</a>
				</div>

				<div
					class="journal-folder-calendar-grid"
					style="grid-template-rows: repeat({renderedWeekCount + 1}, auto)"
				>
					<div class="journal-folder-calendar-divider" aria-hidden="true"></div>
					<div class="journal-folder-calendar-weekday">W</div>
					{#each month.weekdayHeaders as label}
						<div class="journal-folder-calendar-weekday">{label}</div>
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
			</div>
		{/each}
	</div>

	<button
		type="button"
		class="clickable-icon journal-folder-calendar-arrow"
		aria-label="Show later months"
		onclick={scrollForward}
	>
		›
	</button>
</div>
