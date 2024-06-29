import {type TFile} from "obsidian";
import moment from "moment/moment";
import type {HeaderLink} from "./header-link.type";

type JournalFileStrategy = {
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
	createJournalFile: (file: TFile) => JournalFile
	timeUnit: 'day' | 'week' | 'month' | 'year'
}

export abstract class JournalFile {
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
		return (this.file.parent?.children || []).some(file => file.name === name + '.md')
	}

	protected createBackwardLink(): HeaderLink | undefined {
		if (this.isFuture()) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				this.fileMoment.clone().subtract(1, this.strategy.timeUnit))
		}

		return
	}

	protected createForwardLink() {
		if (this.isToday() || this.isFuture()) {
			return this.journalFileLink(
				this.strategy.shortTitlePattern,
				this.strategy.filePattern,
				this.fileMoment.clone().add(1, this.strategy.timeUnit))
		}

		return
	}
}

class DailyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([0-2][0-9])|(3[01]))$/,
		filePattern: 'YYYY-MM-DD',
		titlePattern: 'dddd, DD MMMM YYYY',
		shortTitlePattern: 'ddd, D MMM',
		timeUnit: 'day',
		createJournalFile: (file: TFile) => new DailyFile(file)
	}

	constructor(file: TFile) {
		super(file, DailyFile.STRATEGY)

		this.pushFileTypeLink(this.centerLinks, YearlyFile.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, MonthlyFile.STRATEGY)
		this.pushFileTypeLink(this.centerLinks, WeeklyFile.STRATEGY)
		this.pushToday(this.centerLinks)
	}
}

class WeeklyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
		filePattern: 'YYYY-[W]ww',
		titlePattern: 'YYYY [Week] w',
		shortTitlePattern: '[W]ww',
		timeUnit: 'week',
		createJournalFile: (file: TFile) => new WeeklyFile(file)
	}

	constructor(file: TFile) {
		super(file, WeeklyFile.STRATEGY)
	}
}

class MonthlyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))$/,
		filePattern: 'YYYY-MM',
		titlePattern: 'MMMM YYYY',
		shortTitlePattern: 'MMM',
		timeUnit: 'month',
		createJournalFile: (file: TFile) => new MonthlyFile(file)
	}

	constructor(file: TFile) {
		super(file, MonthlyFile.STRATEGY)
	}
}

class YearlyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}$/,
		filePattern: 'YYYY',
		titlePattern: 'YYYY',
		shortTitlePattern: 'YYYY',
		timeUnit: 'year',
		createJournalFile: (file: TFile) => new YearlyFile(file)
	}

	constructor(file: TFile) {
		super(file, YearlyFile.STRATEGY)
	}
}

const buildStrategies = [
	DailyFile.STRATEGY, WeeklyFile.STRATEGY, MonthlyFile.STRATEGY, YearlyFile.STRATEGY,
]

function getFileStrategy(file: TFile): JournalFileStrategy {
	const buildStrategy = buildStrategies.filter(s => s.fileRegex.test(file.basename)).first()
	if (!buildStrategy) throw new Error(`File name does not represent a valid journal file - ${file.basename}`)
	return buildStrategy
}

export function createJournalFile(file: TFile): JournalFile {
	return getFileStrategy(file).createJournalFile(file)
}
