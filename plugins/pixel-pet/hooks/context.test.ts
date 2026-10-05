import { expect, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

import { TAIL_W, barRow, barWidth, contextFrom, remark, rowAt, rowLabel, shares, summary } from './context'
import type { Context } from './context'

const CATEGORIES = [
  { name: 'System prompt', tokens: 20000, color: 'promptBorder', isDeferred: false, kind: 'used' },
  { name: 'Messages', tokens: 30000, color: 'permission', isDeferred: false, kind: 'used' },
  { name: 'MCP tools (deferred)', tokens: 9000, color: 'inactive', isDeferred: true, kind: 'deferred' },
  { name: 'Free space', tokens: 140000, color: 'inactive', isDeferred: false, kind: 'free' },
  { name: 'Autocompact buffer', tokens: 10000, color: 'warning', isDeferred: false, kind: 'buffer' },
]
const usage = (context: object) => ({ startedAt: 0, rateLimits: [], context }) as unknown as SessionUsage
const full = contextFrom(usage({ window: 200000, percent: 25, breakdown: { categories: CATEGORIES, totalTokens: 50000, maxTokens: 200000, rawMaxTokens: 200000 } })) as Context
const at = (percent: number): Context => ({ total: percent * 2000, max: 200000, percent, rows: [] })

test('the context comes from the breakdown without deferred parts, or from the percent alone', () => {
  expect(full.percent).toEqual(25)
  expect(full.rows.map(r => r.name)).toEqual(['System prompt', 'Messages', 'Free space', 'Autocompact buffer'])
  expect(contextFrom(usage({ window: 200000, percent: 14 }))).toEqual({
    total: 28000, max: 200000, percent: 14,
    rows: [{ name: 'Used', tokens: 28000, kind: 'used' }, { name: 'Free space', tokens: 172000, kind: 'free' }],
  })
  expect(contextFrom(usage({ window: 200000 }))).toBeUndefined()
  // A reading past the window still draws: the bar is full, and no part has fewer than no cells.
  const over = contextFrom(usage({ window: 200000, percent: 120 })) as Context
  expect([over.percent, over.rows[1]?.tokens]).toEqual([100, 0])
  expect(barRow(over, 40).length).toBeGreaterThan(0)
})

test('the bar shares its cells by tokens: used parts full height, free space and the buffer a low track', () => {
  expect(shares(full.rows, 40)).toEqual([4, 6, 28, 2])
  const row = barRow(full, 40)
  expect(row.map(r => r[0])).toEqual(['▀▀▀▀', '▀▀▀▀▀▀', '▄'.repeat(28), '▄▄', ' 25%'])
  expect(row[0]?.[2]).toEqual('#94513b')
  expect(row[2]?.[2]).toBeNull()
  expect(barRow(full, 40, 'Messages 30k').pop()).toEqual([' Messages 30k', null, null])
})

test('the bar follows the band, within bounds', () => {
  expect([20, 60, 100, 400].map(barWidth)).toEqual([8, 40, 80, 120])
})

test('the pointer finds the part under it, and the tail names it within its room', () => {
  expect(rowAt(full, 40, 0)?.name).toEqual('System prompt')
  expect(rowAt(full, 40, 4)?.name).toEqual('Messages')
  expect(rowAt(full, 40, 39)?.name).toEqual('Autocompact buffer')
  expect(rowAt(full, 40, 40)).toBeUndefined()
  expect(rowLabel({ name: 'Autocompact buffer', tokens: 10000, kind: 'buffer' })).toEqual('Autocompact bu… 10k')
  expect(rowLabel({ name: 'Autocompact buffer', tokens: 10000, kind: 'buffer' }).length <= TAIL_W - 1).toEqual(true)
  expect(summary(full)).toEqual('context 50k/200k (25%)')
})

test('the pet speaks the first time the context passes a mark, and when a compaction lightens it', () => {
  expect(remark(undefined, at(80))).toBeUndefined()
  expect(remark(at(40), at(48))).toBeUndefined()
  expect(remark(at(48), at(52))?.text).toEqual('context is half full')
  expect(remark(at(48), at(92))?.text).toEqual('context is almost full!')
  expect(remark(at(76), at(80))).toBeUndefined()
  expect(remark(at(80), at(30))).toEqual({ text: 'phew, lighter! context 30%', isLighter: true })
})
