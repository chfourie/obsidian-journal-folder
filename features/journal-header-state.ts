import {type TFile} from "obsidian";
import moment from "moment/moment";
import type {HeaderLink} from "./header-link.type";

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
	readonly today: moment.Moment = moment().startOf("day")
	readonly title: string
	readonly centerLinks: HeaderLink[] = []
	readonly backwardLink: HeaderLink | undefined
	readonly forwardLink: HeaderLink | undefined

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

	journalFileLink(titlePattern: string, fileNamePattern: string, targetMoment: moment.Moment = this.fileMoment): HeaderLink {
		return {
			title: targetMoment.format(titlePattern),
			url: this.fullPath(targetMoment.format(fileNamePattern))
		}
	}

	protected pushFileTypeLink(links: HeaderLink[], strategy: JournalFileStrategy, hideIfPastAndMissing = true) {
		if (!hideIfPastAndMissing || this.isFuture() || this.currentOrExistingByStrategy(strategy)) {
			links.push(
				this.journalFileLink(
					strategy.shortTitlePattern,
					strategy.filePattern,
					this.fileMoment
				)
			)
		}
	}

	protected isFuture(): boolean {
		return this.fileMoment.isAfter(this.today)
	}

	protected isToday(): boolean {
		return this.currentByPattern()
	}

	protected pushToday(links: HeaderLink[], titlePattern = '[Today]') {
		if (!this.isToday()) {
			links.push(this.journalFileLink(titlePattern, this.strategy.filePattern, this.today))
		}
	}

	protected currentOrExistingByStrategy(strategy: JournalFileStrategy): boolean {
		return this.currentOrExistingByPattern(strategy.filePattern)
	}

	protected currentOrExistingByPattern(pattern = 'YYYY-MM-DD'): boolean {
		const fileName = this.fileMoment.format(pattern)
		return fileName === this.today.format(pattern) || this.journalFileExists(fileName)
	}

	protected currentByPattern(pattern = 'YYYY-MM-DD'): boolean {
		return this.fileMoment.format(pattern) === this.today.format(pattern)
	}

	protected journalFileExists(name: string): boolean {
		return this.getJournalNoteNames().some(noteName => noteName === name)
	}

	protected getJournalNoteNames(filter: RegExp | null = null): string[] {
		const fileNames = (this.file.parent?.children || [])
			.map(f => f.name.replace(/\.md$/, ''))
		return filter ? fileNames.filter(fn => filter.test(fn)) : fileNames
	}

	protected createBackwardLink(): HeaderLink | undefined {
		const prevDate = this.fileMoment.clone().subtract(1, this.strategy.timeUnit)

		if (!prevDate.isBefore(this.today)) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				prevDate)
		}
		return this.linkToNoteNameBefore(this.getJournalNoteNames(this.strategy.fileRegex).sort());
	}

	protected createForwardLink() {
		const nextDate = this.fileMoment.clone().add(1, this.strategy.timeUnit)

		if (!nextDate.isBefore(this.today)) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				nextDate)
		}
		return this.linkToNoteNameBefore(this.getJournalNoteNames(this.strategy.fileRegex).sort().reverse());
	}

	private linkToNoteNameBefore(noteNames: string[]): HeaderLink | undefined {
		const index = noteNames.indexOf(this.file.basename)

		if (index > 0) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				moment(noteNames[index - 1], this.strategy.filePattern)
			)
		}

		return
	}
}

class DailyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([0-2][0-9])|(3[01]))$/,
		filePattern: 'YYYY-MM-DD',
		titlePattern: 'dddd, DD MMMM YYYY',
		shortTitlePattern: 'ddd, D MMM',
		timeUnit: 'day',
		createJournalHeaderState: (file: TFile) => new DailyHeaderState(file)
	}

	constructor(file: TFile) {
		super(file, DailyHeaderState.STRATEGY)

		this.pushFileTypeLink(this.centerLinks, YearlyHeaderState.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, MonthlyHeaderState.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, WeeklyHeaderState.STRATEGY)
		this.pushToday(this.centerLinks)
	}
}

class WeeklyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
		filePattern: 'YYYY-[W]ww',
		titlePattern: 'YYYY [Week] w',
		shortTitlePattern: '[W]ww',
		timeUnit: 'week',
		createJournalHeaderState: (file: TFile) => new WeeklyHeaderState(file)
	}

	constructor(file: TFile) {
		super(file, WeeklyHeaderState.STRATEGY)
	}
}

class MonthlyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))$/,
		filePattern: 'YYYY-MM',
		titlePattern: 'MMMM YYYY',
		shortTitlePattern: 'MMM',
		timeUnit: 'month',
		createJournalHeaderState: (file: TFile) => new MonthlyHeaderState(file)
	}

	constructor(file: TFile) {
		super(file, MonthlyHeaderState.STRATEGY)
	}
}

class YearlyHeaderState extends JournalHeaderState {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}$/,
		filePattern: 'YYYY',
		titlePattern: 'YYYY',
		shortTitlePattern: 'YYYY',
		timeUnit: 'year',
		createJournalHeaderState: (file: TFile) => new YearlyHeaderState(file)
	}

	constructor(file: TFile) {
		super(file, YearlyHeaderState.STRATEGY)
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
