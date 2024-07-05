import { PluginFeature } from '../../data-access'
import type { JournalFolderSettingsStore } from '../../data-access/journal-folder-settings-store.type'

export class JournalFolderSettingsFeature extends PluginFeature {
	constructor(private store: JournalFolderSettingsStore) {}

}
