import { PluginSettingTab } from 'obsidian'
import JournalFolderPlugin from '../../plugin'

export class JournalFolderSettingsTab extends PluginSettingTab {
	constructor(private plugin: JournalFolderPlugin) {
		super(plugin.app, plugin)
	}


	display() {
		throw new Error('Method not implemented.')
	}
}
