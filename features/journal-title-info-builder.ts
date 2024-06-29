import type {TFile} from "obsidian";
import moment from "moment/moment";


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


abstract class JournalTitleInfoBuilder {
	final fileDate: moment.Moment

	constructor(file: TFile) {
		this.fileDate
	}

}
