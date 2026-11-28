// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

const COMPLETION = 0x91b1
const LINK = 0x8b82

/** A WebGL context whose compiler is done when `done` is set, and that counts what would wait for it. */
function compiler({ parallel = true, links = true } = {}) {
  const state: { done: boolean | null; lost: boolean; waits: number } = { done: false, lost: false, waits: 0 }
  const gl = new Proxy({} as Record<string, unknown>, {
    get: (_, name: string) => {
      if (name === 'LINK_STATUS') return LINK
      if (name === 'getExtension') return () => (parallel ? { COMPLETION_STATUS_KHR: COMPLETION } : null)
      if (name === 'isContextLost') return () => state.lost
      if (name === 'getAttribLocation') return () => 0
      if (name === 'getProgramInfoLog') return () => 'no'
      if (name === 'getProgramParameter' || name === 'getShaderParameter')
        return (_: unknown, what: number) => {
          if (what === COMPLETION) return state.done
          state.waits++
          return what === LINK ? links : true
        }
      return /^[A-Z]/.test(name) ? 1 : () => ({})
    },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never)
  return state
}

async function painter() {
  vi.resetModules()
  const { Painter } = await import('./painter')
  return Painter.get()!
}

afterEach(() => void vi.restoreAllMocks())

it('asks nothing of the compiler before it is done', async () => {
  const state = compiler()
  const ready = (await painter()).ready()
  await new Promise((done) => setTimeout(done, 40))
  expect(state.waits).toBe(0)
  state.done = true
  expect(await ready).toBe(true)
  expect(state.waits).toBe(3)
})

it('waits for the compiler where a browser cannot say when it is done', async () => {
  compiler({ parallel: false })
  expect(await (await painter()).ready()).toBe(true)
})

it('says so when it cannot paint', async () => {
  compiler({ links: false }).done = true
  expect(await (await painter()).ready()).toBe(false)
})

it('finishes setup once when ready is asked more than once', async () => {
  const state = compiler()
  const p = await painter()
  const first = p.ready()
  const second = p.ready()
  state.done = true
  expect(await Promise.all([first, second])).toEqual([true, true])
  expect(await p.ready()).toBe(true)
  expect(state.waits).toBe(3)
})

it('stops waiting when the context is lost before linking finishes', async () => {
  const state = compiler()
  const ready = (await painter()).ready()
  state.lost = true
  expect(await ready).toBe(true)
  expect(state.waits).toBe(0)
})

it('stops waiting when the completion query returns null', async () => {
  const state = compiler({ links: false })
  state.done = null
  expect(await (await painter()).ready()).toBe(false)
})
