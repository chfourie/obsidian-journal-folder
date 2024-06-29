import {type TFile} from "obsidian";
import moment from "moment/moment";
import type {LinkInfo} from "./link-info.type";

type JournalFileStrategy = {
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
	createJournalFile: (file: TFile) => JournalFile
}

export abstract class JournalFile {
	readonly fileMoment: moment.Moment
	readonly today: moment.Moment = moment().startOf("day")
	readonly title: string
	readonly centerLinks: LinkInfo[] = []

	protected constructor(protected file: TFile, protected strategy: JournalFileStrategy) {
		this.fileMoment = moment(file.basename, strategy.filePattern)
		this.title = this.fileMoment.format(strategy.titlePattern)
	}

	fullPath(fileName: string): string {
		const path = this.file.parent?.path
		return path ? `${path}/${fileName}` : fileName
	}

	journalFileLink(titlePattern:string, fileNamePattern: string, targetMoment: moment.Moment = this.fileMoment): LinkInfo {
		return {
			title: targetMoment.format(titlePattern),
			url: this.fullPath(targetMoment.format(fileNamePattern))
		}
	}

	protected pushFileTypeLink(links: LinkInfo[], strategy: JournalFileStrategy, onlyIfCurrentOrExisting = true) {
		if (this.currentOrExistingByStrategy(strategy)) {
			links.push(this.journalFileLink(strategy.shortTitlePattern, strategy.filePattern))
		}
	}

	protected pushToday(links: LinkInfo[], titlePattern = '[Today]', onlyIfCurrentOrExisting = true) {
		if (!this.currentByPattern()) {
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
		return (this.file.parent?.children || []).some(file => file.name === name)
	}
}

class DailyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([0-2][0-9])|(3[01]))$/,
		filePattern: 'YYYY-MM-DD',
		titlePattern: 'dddd, DD MMMM YYYY',
		shortTitlePattern: 'ddd, D MMM',
		createJournalFile: (file: TFile) => new DailyFile(file)
	}

	constructor(file: TFile) {
		super(file, DailyFile.STRATEGY)
		this.addCenterLinks()
	}


	protected addCenterLinks() {
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
