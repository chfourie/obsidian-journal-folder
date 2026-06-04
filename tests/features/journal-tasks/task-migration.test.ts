import { beforeEach, describe, expect, it } from 'vitest'
import { App, Notice, TFile, TFolder } from '../../mocks/obsidian'
import type { TaskStatus } from '../../../src/data-access'
import { buildTaskModel, type TaskModel } from '../../../src/features/journal-tasks/task-models'
import {
  buildMigratedLine,
  computeInsertion,
  eligibleMigratedStatuses,
  migrateTasks,
  type MigratableTask,
  transformOriginLine,
} from '../../../src/features/journal-tasks/task-migration'

const status = (overrides: Partial<TaskStatus>): TaskStatus => ({
  id: overrides.id ?? 'open',
  label: overrides.label ?? 'Open',
  char: overrides.char ?? ' ',
  isDone: overrides.isDone ?? false,
  next: overrides.next ?? 'open',
  shell: overrides.shell ?? { shape: 'none' },
  icon: overrides.icon ?? { source: { kind: 'none' } },
})

const STATUSES = (): TaskStatus[] => [
  status({ id: 'open', char: ' ', next: 'in-progress' }),
  status({ id: 'in-progress', char: '/', next: 'done' }),
  status({ id: 'migrated', char: '>', isDone: true, next: 'open' }),
  status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
]

const modelWithMigrated = (): TaskModel =>
  buildTaskModel(STATUSES(), 'plugin', 'migrated')

describe('eligibleMigratedStatuses', () => {
  it('returns only inactive statuses', () => {
    const ids = eligibleMigratedStatuses({
      statuses: STATUSES(),
      rendering: 'plugin',
    }).map((s) => s.id)
    expect(ids).toEqual(['migrated', 'done'])
  })
})

describe('buildMigratedLine', () => {
  const model = modelWithMigrated()

  it('preserves the origin active status and emits a top-level bullet', () => {
    const task = { rawText: '   - [/] do the thing', status: 'in-progress' } as MigratableTask
    expect(buildMigratedLine(task, model)).toBe('- [/] do the thing')
  })

  it('keeps inline links in the body', () => {
    const task = { rawText: '- [ ] call [[Sam]]', status: 'open' } as MigratableTask
    expect(buildMigratedLine(task, model)).toBe('- [ ] call [[Sam]]')
  })

  it('falls back to the first status when the origin status is unknown', () => {
    const task = { rawText: '- [ ] orphan', status: 'ghost' } as MigratableTask
    expect(buildMigratedLine(task, model)).toBe('- [ ] orphan')
  })
})

describe('transformOriginLine', () => {
  const model = modelWithMigrated()

  it('restamps to the migrated status and appends a forward link', () => {
    const out = transformOriginLine(
      '   - [/] do the thing',
      { status: 'in-progress' } as MigratableTask,
      model,
      '2026-06-05'
    )
    expect(out).toBe('   - [>] do the thing → [[2026-06-05]]')
  })

  it('does not double-append an existing link to the same note', () => {
    const out = transformOriginLine(
      '- [/] do the thing → [[2026-06-05]]',
      { status: 'in-progress' } as MigratableTask,
      model,
      '2026-06-05'
    )
    expect(out).toBe('- [>] do the thing → [[2026-06-05]]')
  })

  it('returns null when the line no longer matches the expected status', () => {
    const out = transformOriginLine(
      '- [x] already done',
      { status: 'in-progress' } as MigratableTask,
      model,
      '2026-06-05'
    )
    expect(out).toBeNull()
  })

  it('returns null when the flow has no migrated status', () => {
    const plain = buildTaskModel(STATUSES(), 'plugin')
    const out = transformOriginLine(
      '- [/] x',
      { status: 'in-progress' } as MigratableTask,
      plain,
      '2026-06-05'
    )
    expect(out).toBeNull()
  })
})

describe('computeInsertion', () => {
  const NEW = ['- [ ] migrated task']

  it('end: appends after the last non-blank line, keeping the trailing newline', () => {
    expect(computeInsertion('alpha\nbeta\n', NEW, 'end', 'Tasks')).toBe(
      'alpha\nbeta\n- [ ] migrated task\n'
    )
  })

  it('top: inserts after front matter when present', () => {
    const content = '---\ntitle: x\n---\nbody line\n'
    expect(computeInsertion(content, NEW, 'top', 'Tasks')).toBe(
      '---\ntitle: x\n---\n- [ ] migrated task\nbody line\n'
    )
  })

  it('top: inserts at the start when there is no front matter', () => {
    expect(computeInsertion('body line\n', NEW, 'top', 'Tasks')).toBe(
      '- [ ] migrated task\nbody line\n'
    )
  })

  it('after-last-task: inserts directly after the final task line', () => {
    const content = '# Notes\n- [ ] one\n- [x] two\nmore prose\n'
    expect(computeInsertion(content, NEW, 'after-last-task', 'Tasks')).toBe(
      '# Notes\n- [ ] one\n- [x] two\n- [ ] migrated task\nmore prose\n'
    )
  })

  it('after-last-task: falls back to end of note when there are no tasks', () => {
    expect(
      computeInsertion('just prose\n', NEW, 'after-last-task', 'Tasks')
    ).toBe('just prose\n- [ ] migrated task\n')
  })

  it('heading: inserts under an existing matching heading (case-insensitive)', () => {
    const content = '## tasks\n- [ ] existing\n\n## Notes\n'
    expect(computeInsertion(content, NEW, 'heading', 'Tasks')).toBe(
      '## tasks\n- [ ] migrated task\n- [ ] existing\n\n## Notes\n'
    )
  })

  it('heading: creates the heading at the end when missing', () => {
    expect(computeInsertion('prose\n', NEW, 'heading', 'Tasks')).toBe(
      'prose\n\n## Tasks\n- [ ] migrated task\n'
    )
  })

  it('returns content unchanged when there are no lines to insert', () => {
    expect(computeInsertion('x\n', [], 'end', 'Tasks')).toBe('x\n')
  })
})

// ---- end-to-end -------------------------------------------------

function makeFile(folder: TFolder, basename: string): TFile {
  const file = new TFile()
  file.basename = basename
  file.name = `${basename}.md`
  file.path = `Journal/${basename}.md`
  file.extension = 'md'
  file.parent = folder
  folder.children.push(file)
  return file
}

function setup() {
  Notice.lastMessage = null
  const app = new App()
  const folder = new TFolder()
  folder.path = 'Journal'
  folder.name = 'Journal'
  folder.children = []
  app.vault.addFile(folder)
  const source = makeFile(folder, '2026-06-04')
  const dest = makeFile(folder, '2026-06-05')
  app.vault.addFile(source)
  app.vault.addFile(dest)
  return { app, source, dest }
}

const mig = (file: TFile, line: number, raw: string, status: string): MigratableTask => ({
  sourceFile: file,
  sourceLine: line,
  rawText: raw,
  status,
})

describe('migrateTasks', () => {
  beforeEach(() => {
    Notice.lastMessage = null
  })

  it('writes copies into the destination and stamps the origins with a link', async () => {
    const { app, source, dest } = setup()
    app.vault.setContents(source, ['- [ ] a', '- [/] b', '- [x] c'].join('\n'))
    app.vault.setContents(dest, 'destination body\n')

    await migrateTasks({
      app,
      destFile: dest,
      tasks: [mig(source, 0, '- [ ] a', 'open'), mig(source, 1, '- [/] b', 'in-progress')],
      model: modelWithMigrated(),
      placement: 'end',
      headingText: 'Tasks',
    })

    expect((await app.vault.read(dest)).split('\n')).toEqual([
      'destination body',
      '- [ ] a',
      '- [/] b',
      '',
    ])
    expect((await app.vault.read(source)).split('\n')).toEqual([
      '- [>] a → [[2026-06-05]]',
      '- [>] b → [[2026-06-05]]',
      '- [x] c',
    ])
    expect(Notice.lastMessage).toBe('Migrated 2 tasks → 2026-06-05')
  })

  it('aborts (no writes) when the flow has no migrated status', async () => {
    const { app, source, dest } = setup()
    app.vault.setContents(source, '- [ ] a\n')
    app.vault.setContents(dest, '')

    await migrateTasks({
      app,
      destFile: dest,
      tasks: [mig(source, 0, '- [ ] a', 'open')],
      model: buildTaskModel(STATUSES(), 'plugin'),
      placement: 'end',
      headingText: 'Tasks',
    })

    expect(await app.vault.read(dest)).toBe('')
    expect(await app.vault.read(source)).toBe('- [ ] a\n')
    expect(Notice.lastMessage).toContain('no migrated status')
  })

  it('skips a drifted origin line but still migrates the rest', async () => {
    const { app, source, dest } = setup()
    // Line 1 was captured as in-progress but is now done on disk.
    app.vault.setContents(source, ['- [ ] a', '- [x] b'].join('\n'))
    app.vault.setContents(dest, '')

    await migrateTasks({
      app,
      destFile: dest,
      tasks: [mig(source, 0, '- [ ] a', 'open'), mig(source, 1, '- [/] b', 'in-progress')],
      model: modelWithMigrated(),
      placement: 'end',
      headingText: 'Tasks',
    })

    expect((await app.vault.read(source)).split('\n')).toEqual([
      '- [>] a → [[2026-06-05]]',
      '- [x] b',
    ])
    // The drifted task must NOT be copied to the destination.
    expect(await app.vault.read(dest)).toBe('- [ ] a\n')
    expect(Notice.lastMessage).toBe(
      'Some tasks moved since they were listed — those were skipped. Try again.'
    )
  })
})
