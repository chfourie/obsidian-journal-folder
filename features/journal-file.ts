import {type TFile} from "obsidian";
import moment from "moment/moment";
import type {LinkInfo} from "./link-info.type";

type JournalFileType = 'Day' | 'Week' | 'Month' | 'Year';


type JournalFileStrategy = {
	fileType: JournalFileType
	acronym: string
	fileRegex: RegExp
	filePattern: string
	titlePattern: string
	shortTitlePattern: string
}

const DAY_STRATEGY: JournalFileStrategy = {
	fileType: 'Day',
	acronym: 'D',
	fileRegex: /^20\d{2}-((0[1-9])|(1[12]))-(([012][1-9])|(3[01]))$/,
	filePattern: 'YYYY-MM-DD',
	titlePattern: 'dddd, DD MMMM YYYY',
	shortTitlePattern: 'ddd, D MMM',
}

const WEEK_STRATEGY: JournalFileStrategy = {
	fileType: 'Week',
	acronym: 'W',
	fileRegex: /^W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
	filePattern: 'YYYY-[W]ww',
	titlePattern: 'YYYY [Week] w',
	shortTitlePattern: '[W]ww',
}

const MONTH_STRATEGY: JournalFileStrategy = {
	fileType: 'Month',
	acronym: 'M',
	fileRegex: /^20\d{2}-((0[1-9])|(1[12]))$/,
	filePattern: 'YYYY-MM',
	titlePattern: 'MMMM YYYY',
	shortTitlePattern: 'MMM',
}

const YEAR_STRATEGY: JournalFileStrategy = {
	fileType: 'Year',
	acronym: 'Y',
	fileRegex: /^20\d{2}$/,
	filePattern: 'YYYY',
	titlePattern: 'YYYY',
	shortTitlePattern: 'YYYY',
}

const buildStrategies: JournalFileStrategy[] = [
	DAY_STRATEGY, WEEK_STRATEGY, MONTH_STRATEGY, YEAR_STRATEGY
]

function getFileStrategy(file: TFile): JournalFileStrategy {
	const buildStrategy = buildStrategies.filter(s => s.fileRegex.test(file.basename)).first()
	if (!buildStrategy) throw new Error(`File name does not represent a valid journal file - ${file.basename}`)
	return buildStrategy
}

export class JournalFile {
	readonly #strategy: JournalFileStrategy
	readonly #file: TFile
	readonly fileMoment: moment.Moment
	readonly title: string
	readonly headerCenterLinks: LinkInfo[] = []

	constructor(file: TFile) {
		this.#file = file
		this.#strategy = getFileStrategy(file)
		this.fileMoment = moment(file.basename, this.#strategy.filePattern)
		this.title = this.fileMoment.format(this.#strategy.titlePattern)

		this.addFileTypeLinks();
	}

	private addFileTypeLinks() {
		buildStrategies
			.filter(s => s.fileType !== this.#strategy.fileType)
			.reverse()
			.forEach(strategy => {
				this.headerCenterLinks.push({
					title: this.fileMoment.format(strategy.shortTitlePattern),
					url: this.fullPath(this.fileMoment.format(strategy.filePattern))
				})
			})
	}

	fullPath(fileName: string): string {
		const path = this.#file.parent?.path
		return path ? `${path}/${fileName}` : fileName
	}

	journalFileLink(title:string, pattern: string, targetMoment: moment.Moment = this.fileMoment): LinkInfo {
		return { title, url: this.fullPath(targetMoment.format(pattern)) }
	}
}
