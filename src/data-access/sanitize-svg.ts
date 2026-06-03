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

// Allow-list of SVG elements and attributes the plugin accepts in
// user-provided icon markup. Anything outside the list is stripped.
// Errs on the side of leaving glyphs intact (paths, basic shapes,
// gradients) while refusing anything that can execute code or load
// external resources (`script`, `foreignObject`, `image`, `use`
// with external `href`, event-handler attributes, `javascript:` URLs).
//
// Used by the `'svg'` IconSource kind. Returns either a sanitised
// `<svg>` element ready to inject into the DOM, or `null` if the
// input couldn't be parsed at all.

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'stop',
  'symbol',
  'clipPath',
  'mask',
])

// Per-element attribute allow-lists. Anything not listed is removed.
// `*` covers attributes safe on every element (presentation +
// geometry). The element-specific entries add what each shape needs.
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  '*': new Set([
    'id',
    'class',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'fill-rule',
    'fill-opacity',
    'stroke-opacity',
    'opacity',
    'transform',
    'clip-path',
    'mask',
    'vector-effect',
  ]),
  svg: new Set([
    'viewBox',
    'width',
    'height',
    'xmlns',
    'preserveAspectRatio',
  ]),
  path: new Set(['d']),
  circle: new Set(['cx', 'cy', 'r']),
  ellipse: new Set(['cx', 'cy', 'rx', 'ry']),
  rect: new Set(['x', 'y', 'width', 'height', 'rx', 'ry']),
  line: new Set(['x1', 'y1', 'x2', 'y2']),
  polyline: new Set(['points']),
  polygon: new Set(['points']),
  linearGradient: new Set([
    'x1',
    'y1',
    'x2',
    'y2',
    'gradientUnits',
    'gradientTransform',
    'spreadMethod',
  ]),
  radialGradient: new Set([
    'cx',
    'cy',
    'r',
    'fx',
    'fy',
    'gradientUnits',
    'gradientTransform',
    'spreadMethod',
  ]),
  stop: new Set(['offset', 'stop-color', 'stop-opacity']),
  symbol: new Set(['viewBox', 'preserveAspectRatio']),
  clipPath: new Set(['clipPathUnits']),
  mask: new Set(['maskUnits', 'maskContentUnits', 'x', 'y', 'width', 'height']),
}

const DANGEROUS_VALUE_PATTERN = /(?:javascript|data|vbscript):/i

// Parses `markup` as an SVG document, removes every disallowed tag /
// attribute, and returns the cleaned `<svg>` element. The returned
// node is owned by a fresh document — caller should import it via
// `document.importNode(node, true)` before inserting.
export function sanitizeSvg(markup: string): SVGSVGElement | null {
  if (!markup || typeof DOMParser === 'undefined') return null

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  } catch {
    return null
  }
  // DOMParser reports parse failures via a `<parsererror>` element
  // in the result rather than throwing.
  if (doc.getElementsByTagName('parsererror').length > 0) return null

  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg') return null

  cleanAttributes(root, 'svg')
  cleanNode(root)
  return root as unknown as SVGSVGElement
}

// Sanitises and returns a serialised, ready-to-inject string. Returns
// `null` if the input couldn't be parsed.
export function sanitizeSvgToString(markup: string): string | null {
  const node = sanitizeSvg(markup)
  if (!node) return null
  return new XMLSerializer().serializeToString(node)
}

function cleanNode(node: Element): void {
  // Walk a snapshot — we mutate `node.children` during the loop.
  const children = Array.from(node.children)
  for (const child of children) {
    const tag = child.tagName
    // Compare case-insensitively against the lowercase allow-list:
    // SVG element names like `linearGradient` are case-sensitive on
    // disk but parsers normalise inconsistently across environments.
    const lowered = tag.toLowerCase()
    const allowedTag = Array.from(ALLOWED_TAGS).find(
      (t) => t.toLowerCase() === lowered
    )
    if (!allowedTag) {
      child.remove()
      continue
    }
    cleanAttributes(child, allowedTag)
    cleanNode(child)
  }
}

function cleanAttributes(el: Element, tag: string): void {
  const shared = ALLOWED_ATTRS['*']
  const specific = ALLOWED_ATTRS[tag] ?? new Set<string>()
  // Snapshot — `removeAttribute` mutates the `attributes` collection.
  const attrs = Array.from(el.attributes)
  for (const attr of attrs) {
    const name = attr.name
    // Drop every event handler outright (`onclick`, `onload`, …).
    if (name.toLowerCase().startsWith('on')) {
      el.removeAttribute(name)
      continue
    }
    // Drop URL-bearing attributes that could carry `javascript:` /
    // `data:` payloads. SVG's `href` (and the legacy `xlink:href`)
    // are the typical vectors.
    if (
      (name === 'href' || name === 'xlink:href') &&
      DANGEROUS_VALUE_PATTERN.test(attr.value)
    ) {
      el.removeAttribute(name)
      continue
    }
    if (shared.has(name) || specific.has(name)) {
      continue
    }
    el.removeAttribute(name)
  }
}
