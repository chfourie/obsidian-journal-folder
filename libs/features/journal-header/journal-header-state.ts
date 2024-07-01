import { type TFile } from 'obsidian'
import moment from 'moment/moment'
import type { Link } from '@journal-folder/data-access'

type JournalFileStrategy = {
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
	createJournalHeaderState: (file: TFile) => JournalHeaderState
	timeUnit: 'day' | 'week' | 'month' | 'year'
}

export abstract class JournalHeaderState {
	readonly fileMoment: moment.Moment
	readonly today: moment.Moment = moment().startOf('day')
	readonly title: string
	readonly centerLinks: Link[] = []
	readonly backwardLink: Link | undefined
	readonly forwardLink: Link | undefined
	readonly secondaryLinks: Link[] = []

	protected constructor(protected file: TFile, protected strategy: JournalFileStrategy) {
		this.fileMoment = moment(file.basename, strategy.filePattern)
		this.title = this.fileMoment.format(strategy.titlePattern)
		this.backwardLink = this.createBackwardLink()
		this.forwardLink = this.createForwardLink()
	}

	fullPath(fileName: string): string {
		const path = this.file.parent?.path
		return path ? `${path}/${fileName}` : fileName
	}

	journalFileLink(titlePattern: string, fileNamePattern: string, targetMoment: moment.Moment = this.fileMoment, inactive = false): Link {
		return {
			title: targetMoment.format(titlePattern),
			url: this.fullPath(targetMoment.format(fileNamePattern)),
			inactive,
		}
	}

	protected pushFileTypeLink(links: Link[], strategy: JournalFileStrategy, hideIfPastAndMissing = true) {
		if (!hideIfPastAndMissing || this.isFuture() || this.currentOrExistingByStrategy(strategy)) {
			links.push(
				this.journalFileLink(
					strategy.shortTitlePattern,
					strategy.filePattern,
					this.fileMoment,
				),
			)
		}
	}

	protected isFuture(moment = this.fileMoment): boolean {
		return moment.isAfter(this.today)
	}

	protected isToday(): boolean {
		return false
	}

	protected pushToday(links: Link[], titlePattern = '[Today]') {
		if (!this.isToday()) {
			links.push(this.journalFileLink(titlePattern, DailyHeaderState.STRATEGY.filePattern, this.today))
		}
	}

	protected currentOrExistingByStrategy(strategy: JournalFileStrategy, moment = this.fileMoment): boolean {
		return this.currentOrExistingByPattern(strategy.filePattern, moment)
	}

	protected currentOrExistingByPattern(pattern = 'YYYY-MM-DD', moment = this.fileMoment): boolean {
		const fileName = moment.format(pattern)
		return fileName === this.today.format(pattern) || this.journalFileExists(fileName)
	}

	protected currentByPattern(pattern = 'YYYY-MM-DD'): boolean {
		return this.matchedByPattern(this.fileMoment, this.today, pattern)
	}

	protected matchedByPattern(a: moment.Moment, b: moment.Moment, pattern = 'YYYY-MM-DD'): boolean {
		return a.format(pattern) === b.format(pattern)
	}

	protected journalFileExists(name: string): boolean {
		return this.getJournalNoteNames().some(noteName => noteName === name)
	}

	protected getJournalNoteNames(filter: RegExp | null = null): string[] {
		const fileNames = (this.file.parent?.children || [])
			.map(f => f.name.replace(/\.md$/, ''))
		return filter ? fileNames.filter(fn => filter.test(fn)) : fileNames
	}

	protected getAdjacentNoteLink(beforeOrAfter: 'BEFORE' | 'AFTER'): Link | undefined {
		const thisFileName = this.file.basename
		const multiplier = beforeOrAfter === 'BEFORE' ? -1 : 1
		const fileNames = (this.file.parent?.children || [])
		const adjacentFileName = fileNames.reduce<string | null>((prev, curr) => {
			const currName = curr.name.replace(/\.md$/, '')
			if (!this.strategy.fileRegex.test(currName)) return prev
			if (currName.localeCompare(thisFileName) * multiplier <= 0) return prev
			if (prev == null) return currName
			return (currName.localeCompare(prev) * multiplier < 0) ? currName : prev
		}, null)

		if (adjacentFileName) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				moment(adjacentFileName, this.strategy.filePattern),
			)
		}
	}

	protected createBackwardLink(): Link | undefined {
		const prevDate = this.fileMoment.clone().subtract(1, this.strategy.timeUnit)

		if (!prevDate.isBefore(this.today)) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				prevDate)
		}
		return this.getAdjacentNoteLink('BEFORE')
	}

	protected createForwardLink() {
		const nextDate = this.fileMoment.clone().add(1, this.strategy.timeUnit)

		if (!nextDate.isBefore(this.today)) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				nextDate)
		}
		return this.getAdjacentNoteLink('AFTER')
	}

	protected pushCurrent(links: Link[], titlePattern = this.strategy.shortTitlePattern) {
		if (!this.currentByPattern(this.strategy.filePattern)) {
			links.push(this.journalFileLink(titlePattern, this.strategy.filePattern, this.today))
		}
	}

	protected addSecondaryLinks(links: Link[], strategy: JournalFileStrategy, titlePattern = ''): void {
		const linkedMoment = this.fileMoment.clone()

		while (this.matchedByPattern(linkedMoment, this.fileMoment, this.strategy.filePattern)) {
			links.push(
				this.journalFileLink(
					titlePattern ? titlePattern : strategy.shortTitlePattern,
					strategy.filePattern,
					linkedMoment,
					!(this.currentOrExistingByStrategy(strategy, linkedMoment) || this.isFuture(linkedMoment)),
				),
			)
			linkedMoment.add(1, strategy.timeUnit)
		}
	}
}

class DailyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([0-2][0-9])|(3[01]))$/,
		filePattern: 'YYYY-MM-DD',
		titlePattern: 'dddd, DD MMMM YYYY',
		shortTitlePattern: 'ddd, D MMM',
		timeUnit: 'day',
		createJournalHeaderState: (file: TFile) => new DailyHeaderState(file),
	}

	constructor(file: TFile) {
		super(file, DailyHeaderState.STRATEGY)

		this.pushFileTypeLink(this.centerLinks, YearlyHeaderState.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, MonthlyHeaderState.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, WeeklyHeaderState.STRATEGY)
		this.pushToday(this.centerLinks)
	}

	protected isToday(): boolean {
		return this.currentByPattern()
	}
}

class WeeklyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^\d{4}-W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
		filePattern: 'YYYY-[W]ww',
		titlePattern: 'YYYY [Week] w',
		shortTitlePattern: '[W]ww',
		timeUnit: 'week',
		createJournalHeaderState: (file: TFile) => new WeeklyHeaderState(file),
	}

	constructor(file: TFile) {
		super(file, WeeklyHeaderState.STRATEGY)

		this.pushFileTypeLink(this.centerLinks, YearlyHeaderState.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, MonthlyHeaderState.STRATEGY)
		this.pushCurrent(this.centerLinks)
		this.pushToday(this.centerLinks)

		this.addSecondaryLinks(this.secondaryLinks, DailyHeaderState.STRATEGY)
	}
}

class MonthlyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))$/,
		filePattern: 'YYYY-MM',
		titlePattern: 'MMMM YYYY',
		shortTitlePattern: 'MMM',
		timeUnit: 'month',
		createJournalHeaderState: (file: TFile) => new MonthlyHeaderState(file),
	}

	constructor(file: TFile) {
		super(file, MonthlyHeaderState.STRATEGY)

		this.pushFileTypeLink(this.centerLinks, YearlyHeaderState.STRATEGY)
		this.pushCurrent(this.centerLinks)
		this.pushToday(this.centerLinks)

		this.addSecondaryLinks(this.secondaryLinks, WeeklyHeaderState.STRATEGY)
	}
}

class YearlyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}$/,
		filePattern: 'YYYY',
		titlePattern: 'YYYY',
		shortTitlePattern: 'YYYY',
		timeUnit: 'year',
		createJournalHeaderState: (file: TFile) => new YearlyHeaderState(file),
	}

	constructor(file: TFile) {
		super(file, YearlyHeaderState.STRATEGY)

		this.pushCurrent(this.centerLinks)
		this.pushToday(this.centerLinks)

		this.addSecondaryLinks(this.secondaryLinks, MonthlyHeaderState.STRATEGY)
	}
}

const buildStrategies = [
	DailyHeaderState.STRATEGY, WeeklyHeaderState.STRATEGY, MonthlyHeaderState.STRATEGY, YearlyHeaderState.STRATEGY,
]

function getFileStrategy(file: TFile): JournalFileStrategy {
	const buildStrategy = buildStrategies.filter(s => s.fileRegex.test(file.basename)).first()
	if (!buildStrategy) throw new Error(`File name does not represent a valid journal file - ${file.basename}`)
	return buildStrategy
}

export function createJournalHeaderState(file: TFile): JournalHeaderState {
	return getFileStrategy(file).createJournalHeaderState(file)
}
