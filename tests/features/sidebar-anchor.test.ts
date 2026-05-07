import { describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../mocks/obsidian'
import { DEFAULT_SETTINGS } from '../../src/data-access'
import { buildAnchorNote } from '../../src/features/journal-folder-sidebar/sidebar-anchor'

function setup() {
  const app = new App()
  const folder = new TFolder()
  folder.path = 'Daily'
  folder.name = 'Daily'
  app.vault.addFile(folder)
  return { app, folder }
}

describe('buildAnchorNote', () => {
  it('returns a JournalNote for a daily basename in a known folder', () => {
    const { app } = setup()
    const note = buildAnchorNote(app, 'Daily', '2026-05-07', DEFAULT_SETTINGS)
    expect(note).not.toBeNull()
    expect(note!.getTimeUnit()).toBe('day')
    expect(note!.getMoment().format('YYYY-MM-DD')).toBe('2026-05-07')
  })

  it('returns a JournalNote for a weekly basename', () => {
    const { app } = setup()
    const note = buildAnchorNote(app, 'Daily', '2026-W19', DEFAULT_SETTINGS)
    expect(note).not.toBeNull()
    expect(note!.getTimeUnit()).toBe('week')
  })

  it('returns null for a non-journal basename', () => {
    const { app } = setup()
    expect(
      buildAnchorNote(app, 'Daily', 'random-note', DEFAULT_SETTINGS)
    ).toBeNull()
  })

  it('returns null when the folder is not loaded', () => {
    const { app } = setup()
    expect(
      buildAnchorNote(app, 'Missing', '2026-05-07', DEFAULT_SETTINGS)
    ).toBeNull()
  })

  it('rejects quarterly basenames when quartersEnabled is false', () => {
    const { app } = setup()
    expect(
      buildAnchorNote(app, 'Daily', '2026-Q2', DEFAULT_SETTINGS)
    ).toBeNull()
  })

  it('accepts quarterly basenames when quartersEnabled is true', () => {
    const { app } = setup()
    const note = buildAnchorNote(app, 'Daily', '2026-Q2', {
      ...DEFAULT_SETTINGS,
      quartersEnabled: true,
    })
    expect(note).not.toBeNull()
    expect(note!.getTimeUnit()).toBe('quarter')
  })
})
