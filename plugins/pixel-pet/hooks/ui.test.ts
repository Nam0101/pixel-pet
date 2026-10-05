import { expect, mock, test } from 'claude-code/testing'
import type { On, SessionUsage } from 'claude-code'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const
const HINT = { component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '⏵⏵ auto mode on' } } as const

const BLOCK = { name: 'block', sprite: ['ddddddd', 'ddddddd', 'ddddddd', 'ddddddd'], palette: { d: '#3d84f0' }, eyes: [[0, 1], [4, 1]] }
const CAT = { name: 'Mochi', sprite: ['k.....k', 'kkkkkkk', 'kwkkkwk', 'kkkkkkk'], palette: { k: '#e8a33d', w: '#fff4e0' }, eyes: [[0, 1], [4, 1]] }
const usage: SessionUsage = { startedAt: 0, context: { window: 200000, percent: 14 }, rateLimits: [{ kind: 'five_hour', percentUsed: 38 }] }

/** Answers what the mod asks of Claude Code, and draws Claude Code's own hint line as one Text. Returns the mod's store, kept in memory. */
function stubEngine(on: On) {
  const store = new Map<string, unknown>()
  mock.clock(on)
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('session.start', (_$, e) => e)
  on('session.usage', () => ({ value: usage }))
  on('agent.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: JSON.stringify(BLOCK) }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine hint'] }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('fs.write', (_$, e) => {
    store.set(`file:${e.path}`, e.text)
    return { value: undefined }
  })

  return store
}

test('the band draws the pet, and the hint line draws the HUD in its window', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('"key":"pet"')
  await band.unmount()

  const hint = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...HINT })
  const tree = JSON.stringify(await hint.drawn())
  expect(tree).toContain('▄▄▄')
  expect(tree).toContain('▀▀▀')
  expect(tree).toContain('♥ HP')
  await hint.unmount()
})

test('a theme with a scene draws the band across its width, with the ground in a row below the pet', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const scene = { ground: ['gg'], obstacles: [['gg', 'gg']] }
  await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: { ...BLOCK, palette: { ...BLOCK.palette, g: '#888888' }, scene } })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('"key":"pet"')
  expect(drawn).toContain('"key":"ground"')
  expect(drawn).toContain('"columns":99')
  await band.unmount()
})

test('set_theme draws and keeps a theme, notes what it repaired, and refuses one with no sprite', async ($, on) => {
  const store = stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const set = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: CAT })
  expect(set.deny).toBeUndefined()
  expect(String(set.result)).toContain('The Mochi theme is on screen now')
  expect(store.get('theme')).toEqual(CAT)

  const refused = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: { name: 'nothing' } })
  expect(refused.deny ?? refused.text).toContain('`sprite` is a list of text rows')
  expect(store.get('theme')).toEqual(CAT)

  const noted = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: { ...CAT, palette: { k: '#e8a33d' } } })
  expect(String(noted.result)).toContain('"w" has no palette color, so it is drawn clear.')
  expect(String(noted.result)).toContain('stand, run, jump, think, cheer, and 18 faces')

  const reset = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: null })
  expect(String(reset.result)).toContain('The slime is back')
  expect(store.get('theme')).toBeUndefined()
})

test('set_theme with no theme sets the last preview, and refuses when there is none', async ($, on) => {
  const store = stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const none = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme' })
  expect(none.deny ?? none.text).toContain('no preview_theme call')

  await $.tool.call({ tool: 'mcp__pixel-pet__preview_theme', theme: CAT, path: '/tmp/cat.html' })
  const set = await $.tool.call({ tool: 'mcp__pixel-pet__set_theme' })
  expect(String(set.result)).toContain('The Mochi theme is on screen now')
  expect(store.get('theme')).toEqual(CAT)
})

test('get_theme returns the kept theme, or the slime\'s when none is kept', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const slime = await $.tool.call({ tool: 'mcp__pixel-pet__get_theme' })
  expect(String(slime.result)).toContain('No theme is kept')
  expect(String(slime.result)).toContain('"name":"block"')

  await $.tool.call({ tool: 'mcp__pixel-pet__set_theme', theme: CAT })
  const kept = await $.tool.call({ tool: 'mcp__pixel-pet__get_theme' })
  expect(String(kept.result)).toContain('"name": "Mochi"')
})

test('the settings hide the HUD and the status line', { options: { hud: false, statusLine: false } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('"key":"pet"')
  expect(drawn).not.toContain('›')
  await band.unmount()

  const hint = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...HINT })
  expect(JSON.stringify(await hint.drawn())).not.toContain('♥ HP')
  await hint.unmount()
})

test('preview_theme writes the preview and leaves the pet on screen alone', async ($, on) => {
  const store = stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const wrote = await $.tool.call({ tool: 'mcp__pixel-pet__preview_theme', theme: CAT, path: '/tmp/mochi.html' })
  expect(String(wrote.result)).toContain('Wrote the preview of Mochi to /tmp/mochi.html')
  const page = String(store.get('file:/tmp/mochi.html'))
  for (const part of ['<title>Mochi: preview</title>', 'Motions', 'Faces', 'Frames', 'A subagent starts']) {
    expect(page).toContain(part)
  }
  expect(store.get('theme')).toBeUndefined()

  const nowhere = await $.tool.call({ tool: 'mcp__pixel-pet__preview_theme', theme: CAT })
  expect(nowhere.deny ?? nowhere.text).toContain('`path` is the HTML file to write')
})

test('the band stacks the context bar and the bands beneath under the pet', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('"key":"context"')
  expect(drawn).toContain('hooks/cells.tsx')
  expect(drawn).toContain('engine hint')
  expect(drawn).not.toContain('"key":"legend"')
  await band.unmount()
})

test('a click on the context bar opens its legend, and the pet reads the context out', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  await band.post({ type: 'click', x: 3, from: 3 }, { in: 'context' })
  const open = JSON.stringify(await band.drawn())
  expect(open).toContain('"key":"legend"')
  expect(open).toContain('context 28k/200k (14%)')
  await band.post({ type: 'click', x: 3, from: 3 }, { in: 'context' })
  expect(JSON.stringify(await band.drawn())).not.toContain('"key":"legend"')
  // Pointing at a part names it in the bar's tail: the instance takes it at once, and the next redraw keeps it.
  await band.post({ type: 'hover', x: 0 }, { in: 'context' })
  await band.unmount()
  const pointed = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await pointed.drawn())).toContain(' Used 28k')
  await pointed.post({ type: 'leave', x: 0 }, { in: 'context' })
  await pointed.unmount()
  const left = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await left.drawn())).not.toContain(' Used 28k')
  await left.unmount()
})

test('a drag carries the pet along the band, and a click pokes it', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await band.drawn())).not.toContain('"key":"left"')
  await band.post({ type: 'drag', x: 30, from: 5 }, { in: 'pet' })
  const carried = JSON.stringify(await band.drawn())
  expect(carried).toContain('"key":"left"')
  expect(carried).toContain('"columns":25')
  await band.post({ type: 'drop', x: 30, from: 5 }, { in: 'pet' })
  expect(JSON.stringify(await band.drawn())).toContain('wheee!')
  // A drag whose drop is lost ends at the next thing the pointer does: the pet is no longer drawn mid-air.
  await band.post({ type: 'drag', x: 20, from: 5 }, { in: 'pet' })
  const midAir = JSON.stringify(await band.drawn())
  await band.post({ type: 'leave', x: 0 }, { in: 'pet' })
  expect(JSON.stringify(await band.drawn())).not.toEqual(midAir)
  await band.post({ type: 'click', x: 2, from: 2 }, { in: 'pet' })
  expect(JSON.stringify(await band.drawn())).toContain('hehe, that tickles')
  await band.unmount()
})

test('the cells module turns the pointer into a click', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  await band.pointer({ type: 'down', x: 3, y: 2, button: 'left', in: 'pet' })
  await band.pointer({ type: 'up', x: 3, y: 2, button: 'left', in: 'pet' })
  expect(JSON.stringify(await band.drawn())).toContain('boop!')
  await band.unmount()
})

test('the settings turn off the context bar and the pointer', { options: { contextBar: false, interactive: false } }, async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'pixel-pet', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('"key":"pet"')
  expect(drawn).not.toContain('"key":"context"')
  expect(drawn).not.toContain('hooks/cells.tsx')
  await band.unmount()
})
