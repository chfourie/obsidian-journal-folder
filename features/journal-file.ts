import {type TFile} from "obsidian";
import moment from "moment/moment";
import type {LinkInfo} from "./link-info.type";

type JournalFileType = 'Day' | 'Week' | 'Month' | 'Year';

type JournalFileStrategy = {
	fileType: JournalFileType
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
	createJournalFile: (file: TFile) => JournalFile
}

export abstract class JournalFile {
	readonly #strategy: JournalFileStrategy
	readonly #file: TFile
	readonly fileMoment: moment.Moment
	readonly title: string
	readonly centerLinks: LinkInfo[] = []

	protected constructor(file: TFile, strategy: JournalFileStrategy) {
		this.#file = file
		this.#strategy = strategy
		this.fileMoment = moment(file.basename, this.#strategy.filePattern)
		this.title = this.fileMoment.format(this.#strategy.titlePattern)
	}

	fullPath(fileName: string): string {
		const path = this.#file.parent?.path
		return path ? `${path}/${fileName}` : fileName
	}

	journalFileLink(titlePattern:string, fileNamePattern: string, targetMoment: moment.Moment = this.fileMoment): LinkInfo {
		return {
			title: targetMoment.format(titlePattern),
			url: this.fullPath(targetMoment.format(fileNamePattern))
		}
	}

	shortTitledLink(strategy: JournalFileStrategy, fileMoment: moment.Moment = this.fileMoment): LinkInfo {
		return this.journalFileLink(strategy.shortTitlePattern, strategy.filePattern)
	}
}

class DailyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileType: 'Day',
		fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([012][1-9])|(3[01]))$/,
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
		this.centerLinks.push(this.shortTitledLink(YearlyFile.STRATEGY));
		this.centerLinks.push(this.shortTitledLink(MonthlyFile.STRATEGY));
		this.centerLinks.push(this.shortTitledLink(WeeklyFile.STRATEGY));
	}
}

class WeeklyFile extends JournalFile {
	static readonly STRATEGY: JournalFileStrategy = {
		fileType: 'Week',
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
		fileType: 'Month',
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
		fileType: 'Year',
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
