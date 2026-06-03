import { describe, expect, it } from 'vitest'
import { TFile, TFolder } from '../../mocks/obsidian'
import {
  DEFAULT_SETTINGS,
  journalNoteFactoryWithSettings,
} from '../../../src/data-access'
import { extractTasks } from '../../../src/features/journal-tasks/extract-tasks'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models/simple-model'

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
})
