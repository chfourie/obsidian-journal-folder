import { mount } from 'svelte'
import {PluginFeature} from "./plugin-feature"
import {ErrorMessage, JournalHeader} from "../ui/components"
import type JournalFolderPlugin from "../main"
import type {TFile} from "obsidian"
import type {JournalHeaderInfo} from "./journal-header-info.type"
import moment from "moment/moment";
import type {Link} from "./link.type";

const DAILY_FILE_REGEX = /^20\d{2}-((0[1-9])|(1[12]))-(([012][1-9])|(3[01]))$/
const WEEKLY_FILE_REGEX = /^W((0[1-9])|([1-4][0-9])|(5[0-3]))$/
const MONTHLY_FILE_REGEX = /^20\d{2}-((0[1-9])|(1[12]))$/
const YEARLY_FILE_REGEX = /^20\d{2}$/

const DAILY_FILE_PATTERN = 'YYYY-MM-DD'
const WEEKLY_FILE_PATTERN = 'YYYY-[W]ww'
const MONTHLY_FILE_PATTERN = 'YYYY-MM'
const YEARLY_FILE_PATTERN = 'YYYY'

const DAILY_TITLE_PATTERN = 'dddd, DD MMMM YYYY'
const WEEKLY_TITLE_PATTERN = 'YYYY [Week] w'
const MONTHLY_TITLE_PATTERN = 'MMMM YYYY'
const YEARLY_TITLE_PATTERN = 'YYYY'

export class JournalTitleFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		plugin.registerMarkdownCodeBlockProcessor("journal-title", (source, el, ctx) => {
			try {
				const headerInfo = this.buildHeaderInfo(plugin.getActiveFile())

				// @ts-ignore
				mount(JournalHeader, { target: el, props: { headerInfo } })
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}`} })
			}
		})
	}

	private buildHeaderInfo(file: TFile): JournalHeaderInfo {
		const headerInfo = this.buildDailyHeaderInfo(file) ||
			this.buildWeeklyHeaderInfo(file) ||
			this.buildMonthlyHeaderInfo(file) ||
			this.buildYearlyHeaderInfo(file)

		if (!headerInfo) throw ("File name does not represent a valid journal file")

		return headerInfo
	}

	private buildDailyHeaderInfo(file: TFile): JournalHeaderInfo | undefined {
		if (!DAILY_FILE_REGEX.test(file.basename)) return

		const fileDate: moment.Moment = moment(file.basename, DAILY_FILE_PATTERN)

		return {
			title: fileDate.format(DAILY_TITLE_PATTERN),
			fileTypeLinks: [this.monthLink(file, fileDate), this.monthLink(file, fileDate), this.monthLink(file, fileDate), this.monthLink(file, fileDate)]
		}
	}

	private buildWeeklyHeaderInfo(file: TFile): JournalHeaderInfo | undefined {
		if (!WEEKLY_FILE_REGEX.test(file.basename)) return

		return {
			title: moment(file.basename, WEEKLY_FILE_PATTERN).format(WEEKLY_TITLE_PATTERN),
			fileTypeLinks: []
		}
	}

	private buildMonthlyHeaderInfo(file: TFile): JournalHeaderInfo | undefined {
		if (!MONTHLY_FILE_REGEX.test(file.basename)) return

		return {
			title: moment(file.basename, MONTHLY_FILE_PATTERN).format(MONTHLY_TITLE_PATTERN),
			fileTypeLinks: []
		}
	}

	private buildYearlyHeaderInfo(file: TFile): JournalHeaderInfo | undefined {
		if (!YEARLY_FILE_REGEX.test(file.basename)) return

		return {
			title: moment(file.basename, YEARLY_FILE_PATTERN).format(YEARLY_TITLE_PATTERN),
			fileTypeLinks: []
		}
	}

	private monthLink(file: TFile, fileDate: moment.Moment): Link {
		return { title: 'M', url: `${file.parent?.path}/${fileDate.format(MONTHLY_FILE_PATTERN)}`}
	}

	private journalFileLink(thisFile: TFile, fileDate: moment.Moment): Link {
		return { title: 'M', url: `${thisFile.parent?.path}/${fileDate.format(MONTHLY_FILE_PATTERN)}`}
	}
}
