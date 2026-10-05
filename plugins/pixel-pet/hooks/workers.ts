import { BODY_W, HEIGHT, MAX_MINIS, MINI_SIZE, drawMini, stamp } from './pixels'
import type { Body, Canvas, MiniView } from './pixels'

/**
 * One subagent's mini on the band, at column `x`. `lift` is its height off the ground: the arc of the pet's throw,
 * then a typist's bob at its desk. `isSeated` once it has landed at its station, where its desk stands.
 */
export type Worker = { x: number; k: number; view: MiniView; lift?: number; isSeated: boolean }

/** How long a mini flies from the pet to its station when its subagent starts. */
export const THROW_MS = 700
const THROW_H = 9 // pixels, at the top of the arc
const TYPE_MS = 160 // a typing mini bobs one pixel this often
const BLINK_MS = 320 // the desk's screen changes this often

// The desk a worker types at: a monitor on a table, to the mini's right. The mod's own drawing, in mid tones.
const DESK = ['MMMMM.', 'MnnnM.', 'MnnnM.', 'MMMMM.', '..M...', 'dddddd', 'd....d']
const DESK_COLORS = { M: 0x5a5f70, n: 0x1f2a44, d: 0x8a6a4a }
const CODE = [0x7cc47a, 0xf2c230, 0x8fc7ea]
const DESK_W = 6
/** The columns one station takes: the mini, a gap, and its desk. */
export const STATION_W = MINI_SIZE.w + 1 + DESK_W
const STATION_EVERY = STATION_W + 3
const EDGE = 2 // columns kept clear at the band's right edge

/** The column where worker `k` sits: stations run in from the band's right edge. */
export const station = (k: number, width: number) => Math.max(0, width - EDGE - STATION_W - k * STATION_EVERY)

/**
 * The minis as workers on a band `width` columns wide, with the pet at column `petLeft`. The pet hands each new one
 * its task: the mini flies from the pet to its station in an arc, then types at the desk there until its subagent
 * ends.
 */
export function workersOnBand(views: MiniView[], petLeft: number, width: number): Worker[] {
  const from = petLeft + Math.floor(BODY_W / 2)

  return views.slice(0, MAX_MINIS).map((view, k) => {
    const to = station(k, width)
    if (view.age >= THROW_MS) {
      // A finished mini leaves with its own hop; a working one bobs as it types.
      return view.doneFor === undefined ? { x: to, k, view, lift: Math.floor(view.age / TYPE_MS) % 2, isSeated: true } : { x: to, k, view, isSeated: true }
    }
    const p = Math.max(0, view.age) / THROW_MS

    return { x: Math.round(from + (to - from) * p), k, view, lift: Math.round(Math.sin(p * Math.PI) * THROW_H), isSeated: false }
  })
}

/** Draws the workers on `c`, whose bottom row of pet pixels is row HEIGHT - 1: each seated one at its desk, code moving on the screen. */
export function drawWorkers(c: Canvas, workers: Worker[], body: Body) {
  for (const w of workers) {
    if (w.isSeated) {
      const ox = w.x + MINI_SIZE.w + 1
      const oy = HEIGHT - DESK.length
      stamp(c, ox, oy, DESK, DESK_COLORS)
      if (w.view.doneFor === undefined) {
        const beat = Math.floor(w.view.age / BLINK_MS) + w.k
        c.px[(oy + 1) * c.w + ox + 1 + (beat % 3)] = CODE[beat % CODE.length] as number
        c.px[(oy + 2) * c.w + ox + 1 + ((beat + 1) % 3)] = CODE[(beat + 1) % CODE.length] as number
      }
    }
    drawMini(c, w.x, w.view, w.k, body, w.lift)
  }
}
