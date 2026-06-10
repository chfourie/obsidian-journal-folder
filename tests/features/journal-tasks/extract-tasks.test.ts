import { describe, expect, it } from 'vitest'
import { TFile, TFolder } from '../../mocks/obsidian'
import {
  DEFAULT_SETTINGS,
  journalNoteFactoryWithSettings,
} from '../../../src/data-access'
import {
  extractTasks,
  stripMigrationReferences,
} from '../../../src/features/journal-tasks/extract-tasks'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models'

function buildDailyNote(basename = '2026-06-03') {
  const folder = new TFolder()
  folder.path = 'Journal'
  folder.name = 'Journal'
  folder.children = []
  const file = new TFile()
  file.basename = basename
  file.name = `${basename}.md`
  file.path = `Journal/${basename}.md`
  file.parent = folder
  folder.children.push(file)
  const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(file)
  return { file, note }
}

describe('stripMigrationReferences', () => {
  it('removes a lucide marker and its link', () => {
    expect(
      stripMigrationReferences('Plan hike lucide:undo-dot [[2026-W19]]', [
        'lucide:redo-dot',
        'lucide:undo-dot',
      ])
    ).toBe('Plan hike')
  })

  it('removes a glyph marker and its link', () => {
    expect(
      stripMigrationReferences('Dentist 09:30 → [[2026-06-04]]', ['→', '←'])
    ).toBe('Dentist 09:30')
  })

  it('leaves ordinary links and text untouched', () => {
    expect(
      stripMigrationReferences('see [[Project]] for details', ['→', '←'])
    ).toBe('see [[Project]] for details')
  })

  it('is a no-op when no markers are supplied', () => {
    expect(stripMigrationReferences('task → [[x]]', [])).toBe('task → [[x]]')
  })
})

describe('extractTasks', () => {
  it('returns one entry per task line', () => {
    const { file, note } = buildDailyNote()
    const content = ['- [ ] one', 'plain text', '- [x] two'].join('\n')
    const tasks = extractTasks(content, simpleTaskModel, file, note)
    expect(tasks.map((t) => t.displayText)).toEqual(['one', 'two'])
    expect(tasks.map((t) => t.status)).toEqual(['open', 'done'])
    expect(tasks.map((t) => t.sourceLine)).toEqual([0, 2])
  })

  it('strips wikilink syntax in displayText but keeps rawText', () => {
    const { file, note } = buildDailyNote()
    const content = '- [ ] Review [[Project Alpha|alpha]] update'
    const [task] = extractTasks(content, simpleTaskModel, file, note)
    expect(task.displayText).toBe('Review alpha update')
    expect(task.rawText).toBe(content)
  })

  it('handles indentation', () => {
    const { file, note } = buildDailyNote()
    const content = '    - [ ] indented task'
    const [task] = extractTasks(content, simpleTaskModel, file, note)
    expect(task.displayText).toBe('indented task')
    expect(task.sourceLine).toBe(0)
  })

  it('fills folderPath + noteRangeDays from the journal note', () => {
    const { file, note } = buildDailyNote()
    const [task] = extractTasks(
      '- [ ] task',
      simpleTaskModel,
      file,
      note
    )
    expect(task.folderPath).toBe('Journal')
    expect(task.noteUnit).toBe('day')
    expect(task.noteRangeDays).toBe(1)
    expect(task.noteTitleShort).not.toBe('')
    expect(task.noteTitle).not.toBe('')
  })

  it('matches signifiers / categories and strips their tags from displayText', () => {
    const { file, note } = buildDailyNote()
    const signifiers = [
      {
        id: 'priority',
        label: 'Priority',
        tags: ['important'],
        icon: { source: { kind: 'lucide' as const, name: 'star' } },
      },
      {
        id: 'explore',
        label: 'Explore',
        tags: ['explore'],
        icon: { source: { kind: 'lucide' as const, name: 'eye' } },
      },
    ]
    const categories = [
      { id: 'important', label: 'Important', tags: ['important'] },
    ]
    const [task] = extractTasks(
      '- [ ] Plan #important #explore #keep',
      simpleTaskModel,
      file,
      note,
      [],
      signifiers,
      categories
    )
    expect(task.displayText).toBe('Plan #keep')
    expect(task.signifierIds).toEqual(['priority', 'explore'])
    expect(task.categoryIds).toEqual(['important'])
  })

  it('skips task-like lines inside a fenced code block', () => {
    const { file, note } = buildDailyNote()
    const content = [
      '- [ ] before',
      '```',
      '- [ ] fake',
      '```',
      '- [ ] after',
    ].join('\n')
    const tasks = extractTasks(content, simpleTaskModel, file, note)
    expect(tasks.map((t) => t.displayText)).toEqual(['before', 'after'])
    expect(tasks.map((t) => t.sourceLine)).toEqual([0, 4])
  })

  it('skips task-like lines inside a tilde fence', () => {
    const { file, note } = buildDailyNote()
    const content = ['~~~', '- [ ] fake', '~~~', '- [ ] real'].join('\n')
    const tasks = extractTasks(content, simpleTaskModel, file, note)
    expect(tasks.map((t) => t.sourceLine)).toEqual([3])
  })

  it('skips everything after an unclosed fence', () => {
    const { file, note } = buildDailyNote()
    const content = ['- [ ] real', '```', '- [ ] fake', '- [ ] fake 2'].join(
      '\n'
    )
    const tasks = extractTasks(content, simpleTaskModel, file, note)
    expect(tasks.map((t) => t.sourceLine)).toEqual([0])
  })

  it('skips task-like lines inside an indented (list-nested) fence', () => {
    const { file, note } = buildDailyNote()
    const content = [
      '- [ ] parent',
      '  ```',
      '  - [ ] fake',
      '  ```',
      '- [ ] sibling',
    ].join('\n')
    const tasks = extractTasks(content, simpleTaskModel, file, note)
    expect(tasks.map((t) => t.sourceLine)).toEqual([0, 4])
  })

  it('leaves signifierIds / categoryIds empty when nothing matches', () => {
    const { file, note } = buildDailyNote()
    const [task] = extractTasks('- [ ] Buy milk #groceries', simpleTaskModel, file, note)
    expect(task.displayText).toBe('Buy milk #groceries')
    expect(task.signifierIds).toEqual([])
    expect(task.categoryIds).toEqual([])
  })
})
