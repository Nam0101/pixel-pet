import type { SessionUsage } from 'claude-code'

import type { Run } from './pixels'

/** One part of the context window: a category Claude Code counts, the free space, or the autocompact buffer. */
export type ContextRow = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' }
/** The context window as the bar shows it: tokens in use, the window's size, and its parts. */
export type Context = { total: number; max: number; percent: number; rows: ContextRow[] }

// One mid tone per used category and a darker shade under it, so neighbours read apart on a dark terminal and a light one.
const USED = ['#d97757', '#e0a03c', '#5fae5a', '#4fb8c4', '#8b8ff0', '#e86a8a']
const FREE = '#6b7080'
const BUFFER = '#d9a520'
const WARN_AT = 75
const FULL_AT = 90
/** The share of the window, in percent, at which the pet first speaks up, and what it says. */
const MARKS: [number, string][] = [
  [50, 'context is half full'],
  [WARN_AT, 'context is 75% full… /compact soon?'],
  [FULL_AT, 'context is almost full!'],
]
const LIGHTER_BY = 15 // percent points the context must drop to count as a compaction
/** The columns kept after the bar for its reading, or the name of the part under the pointer. */
export const TAIL_W = 20
const BAR = { min: 8, max: 120 }

const shade = (color: string) =>
  `#${[1, 3, 5].map(i => Math.round(Number.parseInt(color.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, '0')).join('')}`

export const formatTokens = (tokens: number) => (tokens < 1000 ? `${tokens}` : `${(tokens / 1000).toFixed(tokens < 10000 ? 1 : 0)}k`)

/** The context from a usage reading: its breakdown's parts when it has one, else used and free from the percent. */
export function contextFrom(u: SessionUsage): Context | undefined {
  const breakdown = u.context.breakdown
  if (breakdown) {
    const rows = breakdown.categories.flatMap((c): ContextRow[] =>
      c.kind === 'deferred' || c.tokens <= 0 ? [] : [{ name: c.name, tokens: c.tokens, kind: c.kind }],
    )
    const max = breakdown.rawMaxTokens || 1

    return { total: breakdown.totalTokens, max, percent: Math.round((breakdown.totalTokens / max) * 100), rows }
  }
  const reading = u.context.percent
  const max = u.context.window
  if (reading === undefined || !Number.isFinite(reading) || !max) {
    return undefined
  }
  // A reading outside 0 to 100 would give a part fewer than no cells.
  const percent = Math.max(0, Math.min(100, reading))
  const total = Math.round((max * percent) / 100)

  return { total, max, percent: Math.round(percent), rows: [{ name: 'Used', tokens: total, kind: 'used' }, { name: 'Free space', tokens: max - total, kind: 'free' }] }
}

/** The bar's width on a band `columns` wide: all of it but the tail, within bounds. */
export const barWidth = (columns: number) => Math.max(BAR.min, Math.min(BAR.max, columns - TAIL_W))

/** Shares `width` cells among the rows by tokens; the largest remainders take the cells rounding left over. */
export function shares(rows: readonly ContextRow[], width: number): number[] {
  const sum = rows.reduce((all, row) => all + row.tokens, 0) || 1
  const exact = rows.map(row => (row.tokens / sum) * width)
  const counts = exact.map(Math.floor)
  const byRemainder = exact.map((share, at) => ({ at, remainder: share - Math.floor(share) })).sort((a, b) => b.remainder - a.remainder)
  let left = width - counts.reduce((all, count) => all + count, 0)
  for (const { at } of byRemainder) {
    if (left <= 0) {
      break
    }
    counts[at] = (counts[at] as number) + 1
    left -= 1
  }

  return counts
}

/** The color of row `at`: used rows take the ramp in turn; free space and the buffer keep their own. */
export function rowColor(c: Context, at: number) {
  const row = c.rows[at]
  if (row?.kind !== 'used') {
    return row?.kind === 'buffer' ? BUFFER : FREE
  }

  return USED[c.rows.slice(0, at).filter(r => r.kind === 'used').length % USED.length] as string
}

/** The reading's color: the first used color while there is room, a warning from 75 %, red from 90 %. */
export const readingColor = (percent: number) => (percent >= FULL_AT ? '#e5484d' : percent >= WARN_AT ? BUFFER : (USED[0] as string))

/** The row under column `x` of a bar `width` cells wide. */
export function rowAt(c: Context, width: number, x: number): ContextRow | undefined {
  let end = 0
  const counts = shares(c.rows, width)

  return c.rows.find((_, at) => x >= end && x < (end += counts[at] as number))
}

/**
 * The bar as one row of runs, `width` cells and a tail: used parts stand full height, lit above and shaded below; free
 * space and the buffer lie as a low track. The tail is the reading, or `label` in its place.
 */
export function barRow(c: Context, width: number, label?: string): Run[] {
  const counts = shares(c.rows, width)
  const bar = c.rows.flatMap((row, at): Run[] => {
    const n = counts[at] as number
    const color = rowColor(c, at)
    if (n === 0) {
      return []
    }

    return [row.kind === 'used' ? ['▀'.repeat(n), color, shade(color)] : ['▄'.repeat(n), color, null]]
  })
  const tail = ` ${label ?? `${c.percent}%`}`.slice(0, TAIL_W)

  return [...bar, [tail, label === undefined ? readingColor(c.percent) : null, null]]
}

/** What the tail says of one part: its name, cut to fit, and its tokens. */
export function rowLabel(row: ContextRow) {
  const tokens = formatTokens(row.tokens)
  const room = TAIL_W - 2 - tokens.length

  return `${row.name.length > room ? `${row.name.slice(0, room - 1)}…` : row.name} ${tokens}`
}

/** The whole context in a line: what the pet says when its bar is clicked. */
export const summary = (c: Context) => `context ${formatTokens(c.total)}/${formatTokens(c.max)} (${c.percent}%)`

/**
 * What the pet makes of a new reading after `last`: relief when the context dropped by a compaction's worth, or a word
 * the first time it passes a mark. Nothing while it only grows between marks.
 */
export function remark(last: Context | undefined, next: Context): { text: string; isLighter: boolean } | undefined {
  if (!last) {
    return undefined
  }
  if (next.percent <= last.percent - LIGHTER_BY) {
    return { text: `phew, lighter! context ${next.percent}%`, isLighter: true }
  }
  const passed = MARKS.filter(([at]) => last.percent < at && next.percent >= at).pop()

  return passed && { text: passed[1], isLighter: false }
}
