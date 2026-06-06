/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, expect, it } from 'vitest'
import { lineCanReceiveSignifier } from '../../../src/features/journal-signifiers/signifier-live-preview'

describe('lineCanReceiveSignifier', () => {
  it('offers the add affordance on a line with content', () => {
    expect(lineCanReceiveSignifier('a note line')).toBe(true)
    expect(lineCanReceiveSignifier('- a list item')).toBe(true)
    expect(lineCanReceiveSignifier('# Heading')).toBe(true)
  })

  it('does not offer the affordance on a blank or whitespace-only line', () => {
    expect(lineCanReceiveSignifier('')).toBe(false)
    expect(lineCanReceiveSignifier('   ')).toBe(false)
    expect(lineCanReceiveSignifier('\t')).toBe(false)
  })
})
