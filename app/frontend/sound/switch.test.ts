import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Switch from './switch'

class Place extends EventTarget {
  constructor(private readonly within = '') {
    super()
  }
  closest = (selector: string) => (this.within && selector.includes(this.within) ? this : null)
}

/** A click somewhere on a page of its own. */
let click: (within?: string) => void
let page: { activeElement?: { tagName: string } } & EventTarget
let sound: typeof Switch

beforeEach(async () => {
  vi.resetModules()
  const stored = new Map<string, string>()
  page = new EventTarget()
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('Element', Place)
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  })
  click = (within) => {
    const event = new Event('click')
    Object.defineProperty(event, 'target', { value: new Place(within) })
    page.dispatchEvent(event)
  }
  sound = await import('./switch')
})

afterEach(() => vi.unstubAllGlobals())

describe('the sound, on unless it is turned off', () => {
  it('starts with the first click, once', () => {
    const start = vi.fn()
    sound.arm(start)
    expect(start).not.toHaveBeenCalled()
    click()
    click()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('leaves its own buttons to say for themselves', () => {
    const start = vi.fn()
    sound.arm(start)
    click('.wc-sound')
    expect(start).not.toHaveBeenCalled()
  })

  it('stays off once it is turned off, and comes back once it is turned on', () => {
    const start = vi.fn()
    sound.want(false)
    sound.arm(start)
    click()
    expect(start).not.toHaveBeenCalled()
    sound.want(true)
    sound.arm(start)
    click()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts by itself on a page that has been clicked before', () => {
    vi.stubGlobal('navigator', { userActivation: { hasBeenActive: true } })
    const start = vi.fn()
    sound.arm(start)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('is not fetched where data is to be saved', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    const start = vi.fn()
    sound.arm(start)
    click()
    expect(start).not.toHaveBeenCalled()
  })

  it('gives way to a track that is embedded in the page', () => {
    const start = vi.fn()
    sound.arm(start)
    page.activeElement = { tagName: 'IFRAME' }
    window.dispatchEvent(new Event('blur'))
    click()
    expect(start).not.toHaveBeenCalled()
    expect(sound.wanted()).toBe(true)
  })
})
