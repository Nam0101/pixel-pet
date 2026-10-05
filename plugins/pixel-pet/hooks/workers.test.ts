import { expect, test } from 'claude-code/testing'

import { HEIGHT, canvas } from './pixels'
import type { Body } from './pixels'
import { STATION_W, THROW_MS, drawWorkers, station, workersOnBand } from './workers'

const BODY = { palette: {}, mini: { top: 0xffffff, body: 0x3d84f0, edge: 0x1e3a8a } } as unknown as Body

test('a new worker flies from the pet to its station in an arc, then sits and types', () => {
  const at = (age: number) => workersOnBand([{ age }], 10, 100)[0]
  const to = station(0, 100)

  expect(at(0)).toEqual({ x: 19, k: 0, view: { age: 0 }, lift: 0, isSeated: false })
  const mid = at(THROW_MS / 2)
  expect(mid?.x).toBeGreaterThan(19)
  expect(mid?.x).toBeLessThan(to)
  expect(mid?.lift).toEqual(9)
  expect(at(THROW_MS)?.x).toEqual(to)
  expect(at(THROW_MS)?.isSeated).toEqual(true)
  // The typist bobs one pixel, on and off.
  expect([800, 960, 1120].map(age => at(age)?.lift)).toEqual([1, 0, 1])
})

test('stations run in from the right edge, one per worker, and at most six workers sit', () => {
  const workers = workersOnBand(Array.from({ length: 8 }, () => ({ age: 5000 })), 0, 120)

  expect(workers.length).toEqual(6)
  expect(workers.map(w => w.x)).toEqual([105, 89, 73, 57, 41, 25])
  expect(station(9, 20)).toBeLessThan(0)
})

test('a seated worker gets a desk beside it; one still in the air does not', () => {
  const drawn = (age: number) => {
    const c = canvas(60, HEIGHT)
    drawWorkers(c, workersOnBand([{ age }], 0, 60), BODY)
    return c
  }
  // The monitor's top right corner, at the station's last column.
  const deskTop = (c: { w: number; px: number[] }) => c.px[(HEIGHT - 8) * c.w + station(0, 60) + STATION_W - 1]

  expect(deskTop(drawn(2000))).toEqual(0x5a5f70)
  expect(deskTop(drawn(100))).toEqual(-1)
})

test('a mini keeps the station of its slot, and one with no room on the band is not drawn', () => {
  const typing = (slot: number) => ({ age: 5000, slot })
  // The mini in slot 0 has left: slot 1 stays at its own station.
  expect(workersOnBand([typing(1)], 4, 121).map(w => w.x)).toEqual([station(1, 121)])
  // A narrow band seats as many as fit, each at a station of its own.
  const narrow = workersOnBand([0, 1, 2, 3, 4].map(typing), 4, 59).map(w => w.x)
  expect(narrow).toEqual([44, 28, 12])
})
