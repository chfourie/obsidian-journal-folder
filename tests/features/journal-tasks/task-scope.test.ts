import { describe, expect, it } from 'vitest'
import { App, moment, TFile, TFolder } from '../../mocks/obsidian'
import { DEFAULT_SETTINGS } from '../../../src/data-access'
import {
  findTaskCandidates,
  effectiveUnits,
  listJournalNotesInFolder,
  resolveTaskFolders,
} from '../../../src/features/journal-tasks/task-scope'

function setupApp(basenames: string[], folderPath = 'Journal'): App {
  const app = new App()
  const folder = new TFolder()
  folder.path = folderPath
  folder.name = folderPath
  folder.children = []
  app.vault.addFile(folder)
  for (const basename of basenames) {
    const file = new TFile()
    file.basename = basename
    file.name = `${basename}.md`
    file.path = `${folderPath}/${basename}.md`
    file.extension = 'md'
    file.parent = folder
    folder.children.push(file)
    app.vault.addFile(file)
  }
  return app
}

describe('findTaskCandidates', () => {
  it('returns only files inside the configured folders', () => {
    const app = setupApp(['2026-06-03'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['day'],
      referenceRange: {
        start: moment('2026-06-03').startOf('day'),
        end: moment('2026-06-03').endOf('day'),
      },
      settings: DEFAULT_SETTINGS,
    })
    expect(results.map((c) => c.file.basename)).toEqual(['2026-06-03'])
  })

  it('filters by the requested units', () => {
    const app = setupApp(['2026-06-03', '2026-W23', '2026-06'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['day'],
      referenceRange: {
        start: moment('2026-06-01').startOf('day'),
        end: moment('2026-06-30').endOf('day'),
      },
      settings: DEFAULT_SETTINGS,
    })
    expect(results.map((c) => c.file.basename)).toEqual(['2026-06-03'])
  })

  it('keeps higher-tier notes whose range covers the reference day', () => {
    const app = setupApp(['2026-06-03', '2026-W23', '2026-06', '2026'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['day', 'week', 'month', 'year'],
      referenceRange: {
        start: moment('2026-06-03').startOf('day'),
        end: moment('2026-06-03').endOf('day'),
      },
      settings: DEFAULT_SETTINGS,
    })
    expect(new Set(results.map((c) => c.file.basename))).toEqual(
      new Set(['2026-06-03', '2026-W23', '2026-06', '2026'])
    )
  })

  it('excludes a daily note whose date is outside the reference range', () => {
    const app = setupApp(['2026-06-03', '2026-07-15'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['day'],
      referenceRange: {
        start: moment('2026-06-01').startOf('day'),
        end: moment('2026-06-30').endOf('day'),
      },
      settings: DEFAULT_SETTINGS,
    })
    expect(results.map((c) => c.file.basename)).toEqual(['2026-06-03'])
  })

  it('ignores quarterly notes when quartersEnabled is false', () => {
    const app = setupApp(['2026-Q2'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['quarter'],
      referenceRange: {
        start: moment('2026-06-03').startOf('day'),
        end: moment('2026-06-03').endOf('day'),
      },
      settings: { ...DEFAULT_SETTINGS, quartersEnabled: false },
    })
    expect(results).toEqual([])
  })

  it('includes quarterly notes when quartersEnabled is true', () => {
    const app = setupApp(['2026-Q2'])
    const results = findTaskCandidates({
      app,
      folders: ['Journal'],
      units: ['quarter'],
      referenceRange: {
        start: moment('2026-06-03').startOf('day'),
        end: moment('2026-06-03').endOf('day'),
      },
      settings: { ...DEFAULT_SETTINGS, quartersEnabled: true },
    })
    expect(results.map((c) => c.file.basename)).toEqual(['2026-Q2'])
  })
})

describe('listJournalNotesInFolder', () => {
  it('returns journal notes newest-first, excluding the source and non-journal files', () => {
    const app = setupApp([
      '2026-06-03',
      '2026-06-05',
      '2026-06-04',
      'journal-folder',
      'Scratchpad',
    ])
    const result = listJournalNotesInFolder({
      app,
      folderPath: 'Journal',
      settings: DEFAULT_SETTINGS,
      excludePath: 'Journal/2026-06-04.md',
    })
    expect(result.map((f) => f.basename)).toEqual(['2026-06-05', '2026-06-03'])
  })

  it('returns an empty list for a non-existent folder', () => {
    const app = setupApp(['2026-06-03'])
    expect(
      listJournalNotesInFolder({
        app,
        folderPath: 'Nope',
        settings: DEFAULT_SETTINGS,
      })
    ).toEqual([])
  })
})

describe('effectiveUnits', () => {
  it('drops quarter when quartersEnabled is false', () => {
    expect(effectiveUnits(DEFAULT_SETTINGS)).not.toContain('quarter')
  })

  it('keeps quarter when quartersEnabled is true', () => {
    expect(
      effectiveUnits({ ...DEFAULT_SETTINGS, quartersEnabled: true })
    ).toContain('quarter')
  })
})

describe('resolveTaskFolders', () => {
  const ALL = ['Journal', 'Work']
  const allFolders = () => ALL

  it('folder mode "note" → active note folder', () => {
    expect(
      resolveTaskFolders({
        folderMode: 'note',
        folder: '',
        activeNoteFolder: 'Work',
        allFolders,
      })
    ).toEqual(['Work'])
  })

  it('folder mode "note" with no active journal note → all folders', () => {
    expect(
      resolveTaskFolders({
        folderMode: 'note',
        folder: '',
        activeNoteFolder: null,
        allFolders,
      })
    ).toEqual(ALL)
  })

  it('folder mode "all" → every known folder', () => {
    expect(
      resolveTaskFolders({
        folderMode: 'all',
        folder: 'Journal',
        activeNoteFolder: 'Journal',
        allFolders,
      })
    ).toEqual(ALL)
  })

  it('folder mode "specific" → the single folder', () => {
    expect(
      resolveTaskFolders({
        folderMode: 'specific',
        folder: 'Work',
        activeNoteFolder: 'Journal',
        allFolders,
      })
    ).toEqual(['Work'])
  })

  it('folder mode "specific" with empty folder → all folders', () => {
    expect(
      resolveTaskFolders({
        folderMode: 'specific',
        folder: '',
        activeNoteFolder: null,
        allFolders,
      })
    ).toEqual(ALL)
  })

  it('never invokes the all-folders walk when a mode resolves its folder directly', () => {
    let calls = 0
    const counting = () => {
      calls += 1
      return ALL
    }
    resolveTaskFolders({
      folderMode: 'note',
      folder: '',
      activeNoteFolder: 'Work',
      allFolders: counting,
    })
    resolveTaskFolders({
      folderMode: 'specific',
      folder: 'Work',
      activeNoteFolder: null,
      allFolders: counting,
    })
    expect(calls).toBe(0)
  })
})
