import type {TFile} from "obsidian";
import moment from "moment/moment";


export abstract class JournalFile {
	readonly moment: moment.Moment;

	static create(file: TFile): JournalFile {
		return new DailyNote(file)
	}

	protected constructor(protected file: TFile) {
		this.moment = moment(file.basename)
	}
}

class DailyNote extends JournalFile {
	public constructor(file: TFile) {
		super(file);
	}
}
