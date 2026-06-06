import { describe, expect, it } from 'vitest'
import { App } from 'obsidian'
import {
  buildTemplatePreviewNote,
  currentPeriodBasename,
  DEFAULT_TEMPLATE_FILENAME,
  firstNonEmptyTemplate,
  isTemplateBasename,
  overrideFolderPath,
  TEMPLATE_FILENAMES,
  templateCandidatePaths,
  templateFileTier,
  templatePreviewTier,
} from '../../src/data-access/template-folder'
import { DEFAULT_SETTINGS } from '../../src/data-access/journal-folder-settings.type'
import { buildFolder } from '../helpers/fixtures'

describe('isTemplateBasename', () => {
  it('matches the five tier names and default, case-insensitively', () => {
    for (const b of [
      'daily-template',
      'weekly-template',
      'monthly-template',
      'quarterly-template',
      'yearly-template',
      'default-template',
    ])
      expect(isTemplateBasename(b)).toBe(true)
    expect(isTemplateBasename('Monthly-Template')).toBe(true)
    expect(isTemplateBasename('DEFAULT-TEMPLATE')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isTemplateBasename('2026-05')).toBe(false)
    expect(isTemplateBasename('daily')).toBe(false)
    expect(isTemplateBasename('notes')).toBe(false)
  })
})

describe('templatePreviewTier', () => {
  it('maps tier files to their tier and default to day', () => {
    expect(templatePreviewTier('daily-template')).toBe('day')
    expect(templatePreviewTier('weekly-template')).toBe('week')
    expect(templatePreviewTier('monthly-template')).toBe('month')
    expect(templatePreviewTier('quarterly-template')).toBe('quarter')
    expect(templatePreviewTier('yearly-template')).toBe('year')
    expect(templatePreviewTier('default-template')).toBe('day')
  })

  it('returns null for non-template names', () => {
    expect(templatePreviewTier('2026-05')).toBe(null)
    expect(templatePreviewTier('daily')).toBe(null)
  })
})

describe('overrideFolderPath', () => {
  it('joins a journal folder with the override name', () => {
    expect(overrideFolderPath('Journal', 'Templates')).toBe('Journal/Templates')
    expect(overrideFolderPath('A/B', 'T')).toBe('A/B/T')
  })

  it('handles the vault-root cases', () => {
    expect(overrideFolderPath('', 'Templates')).toBe('Templates')
    expect(overrideFolderPath('/', 'Templates')).toBe('Templates')
  })
})

describe('templateFileTier', () => {
  const base = {
    globalTemplateFolder: 'Templates/journal-folder',
    overrideName: 'Templates',
    journalFolderPaths: ['Journal', 'Work/Logs'],
  }

  it('classifies a file in the global template folder', () => {
    expect(
      templateFileTier({
        ...base,
        filePath: 'Templates/journal-folder/monthly-template.md',
      })
    ).toBe('month')
    expect(
      templateFileTier({
        ...base,
        filePath: 'Templates/journal-folder/default-template.md',
      })
    ).toBe('day')
  })

  it('classifies a file in a journal folder override subfolder', () => {
    expect(
      templateFileTier({ ...base, filePath: 'Journal/Templates/weekly-template.md' })
    ).toBe('week')
    expect(
      templateFileTier({
        ...base,
        filePath: 'Work/Logs/Templates/yearly-template.md',
      })
    ).toBe('year')
  })

  it('returns null for a template-named file outside any template folder', () => {
    expect(
      templateFileTier({ ...base, filePath: 'Journal/monthly-template.md' })
    ).toBe(null)
    expect(
      templateFileTier({ ...base, filePath: 'Elsewhere/monthly-template.md' })
    ).toBe(null)
  })

  it('returns null for a non-template name even inside a template folder', () => {
    expect(
      templateFileTier({ ...base, filePath: 'Templates/journal-folder/notes.md' })
    ).toBe(null)
  })
})

describe('templateCandidatePaths', () => {
  it('lists override files then global files for a tier', () => {
    const { override, global } = templateCandidatePaths({
      journalFolderPath: 'Journal',
      overrideName: 'Templates',
      globalTemplateFolder: 'Templates/journal-folder',
      tier: 'month',
    })
    expect(override).toEqual([
      'Journal/Templates/monthly-template.md',
      'Journal/Templates/default-template.md',
    ])
    expect(global).toEqual([
      'Templates/journal-folder/monthly-template.md',
      'Templates/journal-folder/default-template.md',
    ])
  })

  it('omits global paths when no global folder is configured', () => {
    const { global } = templateCandidatePaths({
      journalFolderPath: 'Journal',
      overrideName: 'Templates',
      globalTemplateFolder: '',
      tier: 'day',
    })
    expect(global).toEqual([])
  })
})

describe('firstNonEmptyTemplate', () => {
  it('returns the first non-empty candidate', () => {
    expect(firstNonEmptyTemplate([null, '   ', 'A', 'B'], 'FALLBACK')).toBe('A')
  })

  it('skips whitespace-only and null candidates', () => {
    expect(firstNonEmptyTemplate([null, '  \n ', null], 'FALLBACK')).toBe(
      'FALLBACK'
    )
  })
})

describe('currentPeriodBasename', () => {
  it('formats today in each tier pattern', () => {
    expect(currentPeriodBasename('day')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(currentPeriodBasename('week')).toMatch(/^\d{4}-W\d{2}$/)
    expect(currentPeriodBasename('month')).toMatch(/^\d{4}-\d{2}$/)
    expect(currentPeriodBasename('quarter')).toMatch(/^\d{4}-Q[1-4]$/)
    expect(currentPeriodBasename('year')).toMatch(/^\d{4}$/)
  })
})

describe('buildTemplatePreviewNote', () => {
  it('builds a current-period note for a tier, anchored in the folder', () => {
    const app = new App()
    const { folder } = buildFolder(app, 'Templates/journal-folder', [], {
      folderPath: 'Templates/journal-folder',
    })
    const note = buildTemplatePreviewNote(app, DEFAULT_SETTINGS, 'month', folder)
    expect(note).not.toBeNull()
    expect(note!.name).toMatch(/^\d{4}-\d{2}$/)
  })

  it('returns null for quarter previews when quarters are disabled', () => {
    const app = new App()
    const { folder } = buildFolder(app, 'T', [], { folderPath: 'T' })
    const note = buildTemplatePreviewNote(
      app,
      { ...DEFAULT_SETTINGS, quartersEnabled: false },
      'quarter',
      folder
    )
    expect(note).toBeNull()
  })
})
