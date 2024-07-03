import { type TFile } from 'obsidian'
import moment from 'moment/moment'
import type { Link } from './index'

type JournalNoteStrategy = {
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
	timeUnit: 'day' | 'week' | 'month' | 'year'
}

const DAILY_NOTE_STRATEGY: JournalNoteStrategy = {
	fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([0-2][0-9])|(3[01]))$/,
	filePattern: 'YYYY-MM-DD',
	titlePattern: 'dddd, DD MMMM YYYY',
	shortTitlePattern: 'ddd, D MMM',
	timeUnit: 'day',
}

const WEEKLY_NOTE_STRATEGY: JournalNoteStrategy = {
	fileRegex: /^\d{4}-W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
	filePattern: 'YYYY-[W]ww',
	titlePattern: 'YYYY [Week] w',
	shortTitlePattern: '[W]ww',
	timeUnit: 'week',
}

const MONTHLY_NOTE_STRATEGY: JournalNoteStrategy = {
	fileRegex: /^20\d{2}-((0[1-9])|(1[12]))$/,
	filePattern: 'YYYY-MM',
	titlePattern: 'MMMM YYYY',
	shortTitlePattern: 'MMM',
	timeUnit: 'month',
}

const YEARLY_NOTE_STRATEGY: JournalNoteStrategy = {
	fileRegex: /^20\d{2}$/,
	filePattern: 'YYYY',
	titlePattern: 'YYYY',
	shortTitlePattern: 'YYYY',
	timeUnit: 'year',
}

const STRATEGIES = [
	YEARLY_NOTE_STRATEGY, MONTHLY_NOTE_STRATEGY, WEEKLY_NOTE_STRATEGY, DAILY_NOTE_STRATEGY,
]

function getNoteStrategy(file: TFile): JournalNoteStrategy {
	const buildStrategy = STRATEGIES.filter(s => s.fileRegex.test(file.basename)).first()
	if (!buildStrategy) throw new Error(`File name does not represent a valid journal file - ${file.basename}`)
	return buildStrategy
}

function startOfInterval(sourceMoment: moment.Moment, pattern: string): moment.Moment {
	return moment(sourceMoment.format(pattern), pattern)
}

export function journalNote(file: TFile): JournalNote {
	const strategy = getNoteStrategy(file)
	const today = moment().startOf('day')
	const noteNames = (file.parent?.children || [])
		.map(f => f.name.replace(/\.md$/, ''))

	return new JournalNote(
		file.parent?.path || '',
		noteNames,
		strategy,
		moment(file.basename, strategy.filePattern),
		startOfInterval(today, strategy.filePattern),
		today,
	)
}

export class JournalNote {
	private readonly name: string

	constructor(
		private path: string,
		private noteNames: string[],
		private strategy: JournalNoteStrategy,
		private fileMoment: moment.Moment,
		private present: moment.Moment,
		private today: moment.Moment) {
		this.name = fileMoment.format(this.strategy.filePattern)
	}

	getTitle(): string {
		return this.fileMoment.format(this.strategy.titlePattern)
	}

	forwardInTime(): JournalNote {
		const moment = this.fileMoment.clone().add(1, this.strategy.timeUnit)
		return this.createNoteOfSameTimeUnit(moment)
	}

	backInTime(): JournalNote {
		const moment = this.fileMoment.clone().subtract(1, this.strategy.timeUnit)
		return this.createNoteOfSameTimeUnit(moment)
	}

	// noinspection JSUnusedGlobalSymbols
	presentNote(): JournalNote {
		return this.createNoteOfSameTimeUnit(this.present)
	}

	dailyNoteToday(): JournalNote {
		return this.createNote(DAILY_NOTE_STRATEGY, this.today)
	}

	// noinspection JSUnusedGlobalSymbols
	isFuture(): boolean {
		return this.fileMoment.isAfter(this.present)
	}

	// noinspection JSUnusedGlobalSymbols
	isPast(): boolean {
		return this.fileMoment.isBefore(this.present, this.strategy.timeUnit)
	}

	isPresentTime(): boolean {
		return this.fileMoment.isSame(this.present, this.strategy.timeUnit)
	}

	isPresentOrFuture(): boolean {
		return this.fileMoment.isSameOrAfter(this.present, this.strategy.timeUnit)
	}

	isExistingNote(): boolean {
		return this.noteNames.some(name => name === this.name)
	}

	// noinspection JSUnusedGlobalSymbols
	isMissingNote(): boolean {
		return !this.isExistingNote()
	}

	getHigherOrderNotes(): JournalNote[] {
		const notes: JournalNote[] = []

		for (const strategy of STRATEGIES) {
			if (this.strategy === strategy) break
			notes.push(this.createNote(strategy))
		}

		return notes
	}

	link(titlePattern: 'regular' | 'short' = 'short', inactive = false): Link {
		const pattern = titlePattern === 'regular' ? this.strategy.titlePattern : this.strategy.shortTitlePattern
		return this.linkWithTitlePattern(pattern, inactive)
	}

	linkWithTitlePattern(pattern: string, inactive = false): Link {
		return this.createJournalNoteLink(
			pattern,
			this.strategy.filePattern,
			this.fileMoment,
			inactive,
		)
	}

	closestSibling(beforeOrAfter: 'before' | 'after'): JournalNote | undefined {
		const multiplier = beforeOrAfter === 'before' ? -1 : 1
		const adjacentFileName = this.noteNames.reduce<string | null>((prev, curr) => {
			if (!this.strategy.fileRegex.test(curr)) return prev
			if (curr.localeCompare(this.name) * multiplier <= 0) return prev
			if (prev == null) return curr
			return (curr.localeCompare(prev) * multiplier < 0) ? curr : prev
		}, null)

		if (adjacentFileName) {
			return this.createNoteOfSameTimeUnit(
				moment(adjacentFileName, this.strategy.filePattern),
			)
		}
	}

	private createJournalNoteLink(titlePattern: string, fileNamePattern: string, targetMoment: moment.Moment = this.fileMoment, inactive = false): Link {
		return {
			title: targetMoment.format(titlePattern),
			url: this.fullPath(targetMoment.format(fileNamePattern)),
			inactive,
		}
	}

	private createNoteOfSameTimeUnit(moment: moment.Moment): JournalNote {
		return new JournalNote(
			this.path,
			this.noteNames,
			this.strategy,
			moment,
			this.present,
			this.today,
		)
	}

	private createNote(strategy: JournalNoteStrategy, moment: moment.Moment = this.fileMoment): JournalNote {
		return new JournalNote(
			this.path,
			this.noteNames,
			strategy,
			startOfInterval(moment, strategy.filePattern),
			startOfInterval(this.today, strategy.filePattern),
			this.today,
		)
	}

	private fullPath(fileName: string): string {
		return this.path ? `${this.path}/${fileName}` : fileName
	}
}
