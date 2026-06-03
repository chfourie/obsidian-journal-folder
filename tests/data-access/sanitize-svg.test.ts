import { describe, expect, it } from 'vitest'
import {
  sanitizeSvg,
  sanitizeSvgToString,
} from '../../src/data-access/sanitize-svg'

describe('sanitizeSvg', () => {
  it('returns null for empty / non-svg input', () => {
    expect(sanitizeSvg('')).toBeNull()
    expect(sanitizeSvg('<p>not svg</p>')).toBeNull()
  })

  it('keeps simple shape markup intact', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        '<circle cx="5" cy="5" r="4" fill="red" />' +
        '</svg>'
    )
    expect(out).toContain('<circle')
    expect(out).toContain('cx="5"')
    expect(out).toContain('fill="red"')
  })

  it('strips <script> children', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>' +
        '<path d="M0 0L10 10" /></svg>'
    )
    expect(out).not.toContain('<script')
    expect(out).toContain('<path')
  })

  it('strips event-handler attributes', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="5" cy="5" r="4" onclick="alert(1)" />' +
        '</svg>'
    )
    expect(out).not.toContain('onclick')
  })

  it('strips javascript: URLs from href attributes', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M0 0" href="javascript:alert(1)" />' +
        '</svg>'
    )
    expect(out).not.toContain('javascript:')
  })

  it('drops unknown elements like <foreignObject>', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<foreignObject><iframe src="evil" /></foreignObject>' +
        '<path d="M0 0" />' +
        '</svg>'
    )
    expect(out).not.toContain('foreignObject')
    expect(out).not.toContain('iframe')
    expect(out).toContain('<path')
  })

  it('drops unknown attributes (xmlns:xlink) but keeps geometry', () => {
    const out = sanitizeSvgToString(
      '<svg xmlns="http://www.w3.org/2000/svg" data-foo="bar">' +
        '<rect x="0" y="0" width="10" height="10" />' +
        '</svg>'
    )
    expect(out).not.toContain('data-foo')
    expect(out).toContain('width="10"')
  })
})
