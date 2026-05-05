#!/usr/bin/env node
/*
 * Headless screenshot harness for the Journal Folder README.
 *
 * Each scenario produces a static HTML page that loads the plugin's real
 * styles.css plus a minimal Obsidian-light stand-in (obsidian-light.css).
 * Playwright then opens each page and screenshots a single element so the
 * output is tightly cropped — no manual viewport sizing required.
 *
 * Why not Obsidian itself? Screen recording on macOS needs a permission
 * grant Claude Code can't acquire from inside its sandbox. Playwright +
 * static HTML runs with no permissions, no GUI, fully reproducible.
 *
 * Run: node docs/screenshot-harness/render.mjs
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import moment from 'moment'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const OUTPUT_DIR = resolve(REPO_ROOT, 'docs/screenshots')
const PAGES_DIR = resolve(__dirname, '_pages')

// ─── Anchor date for every scenario ─────────────────────────────────────────
// Today in the demo world. Any date NOT in EXISTING_NOTES renders as a
// missing/past-empty cell in the calendar.
const TODAY = moment('2026-05-04')
const EXISTING_NOTES = new Set([
  // Daily
  '2026-04-15',
  '2026-04-20',
  '2026-04-22',
  '2026-04-27',
  '2026-04-30',
  '2026-05-01',
  '2026-05-04',
  // Weekly
  '2026-W17',
  '2026-W18',
  '2026-W19',
  // Monthly
  '2026-04',
  '2026-05',
  // Yearly
  '2026',
])
const FOLDER_TITLE = 'Atlas Migration'

// ─── Pure HTML renderers (mirror the Svelte components) ─────────────────────

function renderHeader({
  folderTitle,
  title,
  backwardLink,
  forwardLink,
  todayLink,
  morePopover,
  calendar,
  moreOpen = false,
}) {
  return `
<div class="journal-folder-header">
  ${folderTitle ? `<div class="journal-folder-header-folder-title">${escape(folderTitle)}</div>` : ''}
  <h1 class="journal-folder-header-title">${escape(title)}</h1>
  <div class="journal-folder-header-options">
    <div class="journal-folder-header-links">
      ${backwardLink ? renderChip(backwardLink) + `<div>&lt;--</div>` : ''}
      <div class="journal-folder-header-more">
        <span class="internal-link journal-folder-note-link chip${moreOpen ? ' open' : ''}" role="button" tabindex="0" aria-haspopup="true" aria-expanded="${moreOpen}">More...</span>
      </div>
      ${todayLink ? renderChip(todayLink) : ''}
      ${forwardLink ? `<div>--&gt;</div>` + renderChip(forwardLink) : ''}
    </div>
  </div>
  ${calendar ?? ''}
</div>
${morePopover ?? ''}
`
}

function renderChip(link) {
  return `<a class="internal-link journal-folder-note-link chip" href="${escape(link.url)}">${escape(link.title)}</a>`
}

function renderRegularLink(link) {
  if (link.inactive) {
    return `<span class="journal-folder-note-link no-link">${escape(link.title)}</span>`
  }
  return `<a class="internal-link journal-folder-note-link" href="${escape(link.url)}">${escape(link.title)}</a>`
}

function renderMorePopover({
  moreLinksLabel,
  moreLinks,
  secondaryLinksLabel,
  secondaryLinks,
  calendarVisible = false,
}) {
  // In the live plugin the panel is portaled to <body> as position: fixed.
  // For the harness we anchor it inline directly below the header so the
  // screenshot crops cleanly — visually identical to the deployed look.
  return `
<div class="journal-folder-header-more-panel" style="position: static; margin-top: 6px; width: auto;" role="menu">
  <div class="journal-folder-header-more-panel-section">
    <div class="journal-folder-header-more-panel-section-header">
      <div class="journal-folder-header-more-panel-section-label">${escape(moreLinksLabel)}</div>
      <span class="journal-folder-calendar-toggle${calendarVisible ? ' active' : ''}" role="button" tabindex="0">${calendarVisible ? 'Hide calendar' : 'Show calendar'}</span>
    </div>
    <div class="journal-folder-header-more-panel-section-rule"></div>
    ${
      moreLinks.length
        ? `<div class="journal-folder-header-more-panel-list">${moreLinks.map(renderRegularLink).join('')}</div>`
        : ''
    }
  </div>
  ${
    secondaryLinks.length
      ? `<div class="journal-folder-header-more-panel-section">
           <div class="journal-folder-header-more-panel-section-label">${escape(secondaryLinksLabel)}</div>
           <div class="journal-folder-header-more-panel-section-rule"></div>
           <div class="journal-folder-header-more-panel-list">${secondaryLinks.map(renderRegularLink).join('')}</div>
         </div>`
      : ''
  }
</div>`
}

// ─── Calendar (mirrors journal-calendar-info.ts + JournalCalendar.svelte) ───

function noteExistsForDay(m) { return EXISTING_NOTES.has(m.format('YYYY-MM-DD')) }
function noteExistsForWeek(m) { return EXISTING_NOTES.has(m.format('gggg-[W]ww')) }
function noteExistsForMonth(m) { return EXISTING_NOTES.has(m.format('YYYY-MM')) }
function noteExistsForYear(m) { return EXISTING_NOTES.has(m.format('YYYY')) }

function renderCalendar({
  currentNoteUnit,
  currentNoteMoment,
  visibleMonthCount,
  isMobile = false,
}) {
  const monthsBefore = Math.floor(Math.max(1, visibleMonthCount) / 2)
  const anchor = currentNoteMoment.clone().startOf('month')
  const firstMonth = anchor.clone().subtract(monthsBefore, 'month')

  const months = []
  for (let i = 0; i < visibleMonthCount; i++) {
    months.push(buildMonth(firstMonth.clone().add(i, 'month')))
  }

  function buildMonth(monthMoment) {
    const monthStart = monthMoment.clone().startOf('month')
    const gridStart = monthStart.clone().startOf('week')
    const weekdayHeaders = []
    for (let i = 0; i < 7; i++) {
      weekdayHeaders.push(gridStart.clone().add(i, 'day').format('dd'))
    }

    const weeks = []
    for (let row = 0; row < 6; row++) {
      const days = []
      for (let col = 0; col < 7; col++) {
        const day = gridStart.clone().add(row * 7 + col, 'day')
        days.push(buildDayCell(day, monthStart))
      }
      const rowStart = gridStart.clone().add(row * 7, 'day')
      weeks.push({ weekCell: buildWeekCell(rowStart), days })
    }

    return {
      monthCell: buildMonthCell(monthStart),
      yearCell: buildYearCell(monthStart),
      weekdayHeaders,
      weeks,
    }
  }

  function isCurrent(unit, m) {
    if (currentNoteUnit !== unit) return false
    return m.isSame(currentNoteMoment, unit)
  }

  function buildDayCell(day, monthStart) {
    const exists = noteExistsForDay(day)
    const isPast = day.isBefore(TODAY, 'day')
    return {
      label: day.format('D'),
      url: day.format('YYYY-MM-DD'),
      exists,
      isCurrent: isCurrent('day', day),
      isToday: day.isSame(TODAY, 'day'),
      needsConfirmation: isPast && !exists,
      isOutsideMonth: !day.isSame(monthStart, 'month'),
    }
  }
  function buildWeekCell(rowStart) {
    const exists = noteExistsForWeek(rowStart)
    const isPast = rowStart.clone().endOf('week').isBefore(TODAY, 'day')
    return {
      label: rowStart.format('w'),
      url: rowStart.format('gggg-[W]ww'),
      exists,
      isCurrent: isCurrent('week', rowStart),
      isToday: false,
      needsConfirmation: isPast && !exists,
      isOutsideMonth: false,
    }
  }
  function buildMonthCell(monthStart) {
    const exists = noteExistsForMonth(monthStart)
    const isPast = monthStart.clone().endOf('month').isBefore(TODAY, 'day')
    return {
      label: monthStart.format('MMM'),
      url: monthStart.format('YYYY-MM'),
      exists,
      isCurrent: isCurrent('month', monthStart),
      isToday: false,
      needsConfirmation: isPast && !exists,
      isOutsideMonth: false,
    }
  }
  function buildYearCell(monthStart) {
    const exists = noteExistsForYear(monthStart)
    const isPast = monthStart.clone().endOf('year').isBefore(TODAY, 'day')
    return {
      label: monthStart.format('YYYY'),
      url: monthStart.format('YYYY'),
      exists,
      isCurrent: isCurrent('year', monthStart),
      isToday: false,
      needsConfirmation: isPast && !exists,
      isOutsideMonth: false,
    }
  }

  function classesFor(cell, kind) {
    const c = ['journal-folder-calendar-cell']
    if (cell.isCurrent) c.push('is-current')
    if (cell.isToday) c.push('is-today')
    c.push(cell.exists ? 'exists' : 'missing')
    if (cell.needsConfirmation) c.push('past-missing')
    if (kind) c.push(kind)
    return c.join(' ')
  }

  const monthHTML = months
    .map((month) => {
      const weekRows = month.weeks
        .filter((w) => !w.days.every((d) => d.isOutsideMonth))
        .map((week) => {
          const weekCellHTML = `<a class="internal-link ${classesFor(week.weekCell, 'week')}" href="${escape(week.weekCell.url)}">${escape(week.weekCell.label)}</a>`
          const dayCellsHTML = week.days
            .map((day) =>
              day.isOutsideMonth
                ? `<div class="journal-folder-calendar-cell empty" aria-hidden="true"></div>`
                : `<a class="internal-link ${classesFor(day, 'day')}" href="${escape(day.url)}">${escape(day.label)}</a>`
            )
            .join('')
          return weekCellHTML + dayCellsHTML
        })
        .join('')

      const weekdayHeaders = month.weekdayHeaders
        .map((h) => `<div class="journal-folder-calendar-weekday">${escape(h)}</div>`)
        .join('')

      return `
<div class="journal-folder-calendar-month">
  <div class="journal-folder-calendar-month-title">
    <a class="internal-link ${classesFor(month.monthCell)}" href="${escape(month.monthCell.url)}">${escape(month.monthCell.label)}</a>
    <a class="internal-link ${classesFor(month.yearCell)}" href="${escape(month.yearCell.url)}">${escape(month.yearCell.label)}</a>
  </div>
  <div class="journal-folder-calendar-grid">
    <div class="journal-folder-calendar-weekday-corner"></div>
    ${weekdayHeaders}
    ${weekRows}
  </div>
</div>`
    })
    .join('')

  return `
<div class="journal-folder-calendar${isMobile ? ' is-mobile' : ''}">
  <button type="button" class="clickable-icon journal-folder-calendar-arrow" aria-label="Show earlier months">‹</button>
  <div class="journal-folder-calendar-months">${monthHTML}</div>
  <button type="button" class="clickable-icon journal-folder-calendar-arrow" aria-label="Show later months">›</button>
</div>`
}

// ─── HTML envelope ──────────────────────────────────────────────────────────

function pageHTML({ body, stageClass = 'stage' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="../obsidian-light.css" />
<link rel="stylesheet" href="../../../styles.css" />
<style>
  button.clickable-icon {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>
</head>
<body>
  <div class="${stageClass}" id="stage">
    ${body}
  </div>
</body>
</html>`
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch])
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    name: 'header-daily',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: TODAY.format('dddd, DD MMMM YYYY'),
          backwardLink: { title: 'Fri, 1 May', url: '2026-05-01' },
          forwardLink: { title: 'Tue, 5 May', url: '2026-05-05' },
        }),
      }),
  },
  {
    name: 'header-weekly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: '2026 Week 19',
          backwardLink: { title: 'W18', url: '2026-W18' },
          forwardLink: { title: 'W20', url: '2026-W20' },
          todayLink: { title: 'Today', url: '2026-05-04' },
        }),
      }),
  },
  {
    name: 'header-monthly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: 'May 2026',
          backwardLink: { title: 'Apr', url: '2026-04' },
          forwardLink: { title: 'Jun', url: '2026-06' },
          todayLink: { title: 'Today', url: '2026-05-04' },
        }),
      }),
  },
  {
    name: 'header-yearly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: '2026',
          backwardLink: { title: '2025', url: '2025' },
          forwardLink: { title: '2027', url: '2027' },
          todayLink: { title: 'Today', url: '2026-05-04' },
        }),
      }),
  },
  {
    name: 'header-no-folder-title',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          title: TODAY.format('dddd, DD MMMM YYYY'),
          backwardLink: { title: 'Fri, 1 May', url: '2026-05-01' },
          forwardLink: { title: 'Tue, 5 May', url: '2026-05-05' },
        }),
      }),
  },

  // The "More..." popover scenarios. In the live plugin the panel is
  // portaled to <body>; for screenshots it sits inline directly below the
  // chip bar — visually identical, just easier to crop.
  {
    name: 'more-popover-daily',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: `${renderHeader({
          folderTitle: FOLDER_TITLE,
          title: TODAY.format('dddd, DD MMMM YYYY'),
          backwardLink: { title: 'Fri, 1 May', url: '2026-05-01' },
          forwardLink: { title: 'Tue, 5 May', url: '2026-05-05' },
          moreOpen: true,
          morePopover: renderMorePopover({
            moreLinksLabel: 'View',
            moreLinks: [
              { title: '2026', url: '2026' },
              { title: 'May', url: '2026-05' },
              { title: 'W19', url: '2026-W19' },
            ],
            secondaryLinksLabel: '',
            secondaryLinks: [],
            calendarVisible: false,
          }),
        })}`,
      }),
  },
  {
    name: 'more-popover-weekly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: `${renderHeader({
          folderTitle: FOLDER_TITLE,
          title: '2026 Week 19',
          backwardLink: { title: 'W18', url: '2026-W18' },
          forwardLink: { title: 'W20', url: '2026-W20' },
          todayLink: { title: 'Today', url: '2026-05-04' },
          moreOpen: true,
          morePopover: renderMorePopover({
            moreLinksLabel: 'View',
            moreLinks: [
              { title: '2026', url: '2026' },
              { title: 'May', url: '2026-05' },
            ],
            secondaryLinksLabel: 'Day',
            secondaryLinks: [
              { title: 'Mon, 04 May', url: '2026-05-04' },
              { title: 'Tue, 05 May', url: '2026-05-05' },
              { title: 'Wed, 06 May', url: '2026-05-06' },
              { title: 'Thu, 07 May', url: '2026-05-07' },
              { title: 'Fri, 08 May', url: '2026-05-08' },
              { title: 'Sat, 09 May', url: '2026-05-09' },
              { title: 'Sun, 10 May', url: '2026-05-10' },
            ],
            calendarVisible: false,
          }),
        })}`,
      }),
  },
  {
    name: 'more-popover-monthly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: `${renderHeader({
          folderTitle: FOLDER_TITLE,
          title: 'May 2026',
          backwardLink: { title: 'Apr', url: '2026-04' },
          forwardLink: { title: 'Jun', url: '2026-06' },
          todayLink: { title: 'Today', url: '2026-05-04' },
          moreOpen: true,
          morePopover: renderMorePopover({
            moreLinksLabel: 'View',
            moreLinks: [{ title: '2026', url: '2026' }],
            secondaryLinksLabel: 'Week',
            secondaryLinks: [
              { title: 'Week 18', url: '2026-W18' },
              { title: 'Week 19', url: '2026-W19' },
              { title: 'Week 20', url: '2026-W20' },
              { title: 'Week 21', url: '2026-W21' },
              { title: 'Week 22', url: '2026-W22' },
            ],
            calendarVisible: true,
          }),
        })}`,
      }),
  },

  {
    name: 'calendar-3-months',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: TODAY.format('dddd, DD MMMM YYYY'),
          backwardLink: { title: 'Fri, 1 May', url: '2026-05-01' },
          forwardLink: { title: 'Tue, 5 May', url: '2026-05-05' },
          calendar: renderCalendar({
            currentNoteUnit: 'day',
            currentNoteMoment: TODAY,
            visibleMonthCount: 3,
          }),
        }),
      }),
  },
  {
    name: 'calendar-from-monthly',
    stageWidth: 760,
    html: () =>
      pageHTML({
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: 'May 2026',
          backwardLink: { title: 'Apr', url: '2026-04' },
          forwardLink: { title: 'Jun', url: '2026-06' },
          todayLink: { title: 'Today', url: '2026-05-04' },
          calendar: renderCalendar({
            currentNoteUnit: 'month',
            currentNoteMoment: moment('2026-05-01'),
            visibleMonthCount: 3,
          }),
        }),
      }),
  },
  {
    name: 'calendar-mobile',
    stageWidth: 420,
    html: () =>
      pageHTML({
        stageClass: 'stage stage--mobile',
        body: renderHeader({
          folderTitle: FOLDER_TITLE,
          title: TODAY.format('dddd, DD MMMM YYYY'),
          backwardLink: { title: 'Fri, 1 May', url: '2026-05-01' },
          forwardLink: { title: 'Tue, 5 May', url: '2026-05-05' },
          calendar: renderCalendar({
            currentNoteUnit: 'day',
            currentNoteMoment: TODAY,
            visibleMonthCount: 1,
            isMobile: true,
          }),
        }),
      }),
  },
]

// ─── Driver ─────────────────────────────────────────────────────────────────

function ensureClean(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  ensureClean(PAGES_DIR)

  const browser = await chromium.launch()
  try {
    for (const scenario of SCENARIOS) {
      const pagePath = resolve(PAGES_DIR, `${scenario.name}.html`)
      writeFileSync(pagePath, scenario.html())

      const context = await browser.newContext({
        viewport: { width: scenario.stageWidth + 60, height: 800 },
        deviceScaleFactor: 2,
      })
      const page = await context.newPage()
      await page.goto(pathToFileURL(pagePath).href)
      await page.waitForLoadState('networkidle')

      const stage = page.locator('#stage')
      await stage.screenshot({
        path: resolve(OUTPUT_DIR, `${scenario.name}.png`),
        omitBackground: false,
      })
      await context.close()
      console.log(`✓ ${scenario.name}.png`)
    }
  } finally {
    await browser.close()
  }
  console.log(`\nAll screenshots written to ${OUTPUT_DIR}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
