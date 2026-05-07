import { describe, expect, it } from 'vitest'
import { camelCase, kebabCase } from '../../src/data-access/string-utils'

describe('camelCase', () => {
  it('converts kebab-case to camelCase', () => {
    expect(camelCase('journal-folder-title')).toBe('journalFolderTitle')
  })

  it('converts snake_case to camelCase', () => {
    expect(camelCase('journal_folder_title')).toBe('journalFolderTitle')
  })

  it('converts space-separated words to camelCase', () => {
    expect(camelCase('journal folder title')).toBe('journalFolderTitle')
  })

  it('lower-cases SCREAMING_SNAKE_CASE', () => {
    expect(camelCase('JOURNAL_FOLDER_TITLE')).toBe('journalFolderTitle')
  })

  it('lower-cases mixed-case input first', () => {
    expect(camelCase('Journal-Folder-Title')).toBe('journalFolderTitle')
  })

  it('handles a mix of separators', () => {
    expect(camelCase('journal folder-title_pattern')).toBe(
      'journalFolderTitlePattern'
    )
  })

  it('trims surrounding whitespace', () => {
    expect(camelCase('  hello-world  ')).toBe('helloWorld')
  })

  it('returns the same string for a single lower-case word', () => {
    expect(camelCase('hello')).toBe('hello')
  })

  it('returns an empty string for empty input', () => {
    expect(camelCase('')).toBe('')
  })
})

describe('kebabCase', () => {
  it('inserts hyphens before each uppercase letter and lowercases', () => {
    expect(kebabCase('dailyNoteTitlePattern')).toBe('daily-note-title-pattern')
    expect(kebabCase('quartersEnabled')).toBe('quarters-enabled')
    expect(kebabCase('autoTemplateContent')).toBe('auto-template-content')
  })

  it('round-trips with camelCase', () => {
    const camel = 'defaultCalendarVisibleDesktop'
    expect(camelCase(kebabCase(camel))).toBe(camel)
  })

  it('leaves an already-lowercase string unchanged', () => {
    expect(kebabCase('foo')).toBe('foo')
  })
})
