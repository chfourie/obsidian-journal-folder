import { DEFAULT_SETTINGS, PluginFeature } from '../../data-access'
import  JournalFolderPlugin from '../../plugin/journal-folder-plugin'

export class JournalFolderSettingsFeature extends PluginFeature<JournalFolderPlugin> {

	constructor(plugin: JournalFolderPlugin) {
		super(plugin)
		this.useSettings(DEFAULT_SETTINGS)
	}

	async load(): Promise<void> {
		return super.load();
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		const settings = {...this.settings, ...await this.plugin.loadData()}
		await this.plugin.saveData(settings)
		this.plugin.useSettings(settings)
	}
}
