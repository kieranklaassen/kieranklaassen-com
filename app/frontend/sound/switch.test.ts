import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ear as EarValue, Heard, View } from './ear'
import type { Place as SoundPlace } from './place'
import type * as Switch from './switch'

class Place extends EventTarget {
  constructor(private readonly within = '') {
    super()
  }
  closest = (selector: string) => (this.within && selector.includes(this.within) ? this : null)
}

interface FakeWindow extends EventTarget {
  scrollY: number
  setTimeout: typeof globalThis.setTimeout
  clearTimeout: typeof globalThis.clearTimeout
  setInterval: typeof globalThis.setInterval
  clearInterval: typeof globalThis.clearInterval
}

interface FakeDocument extends EventTarget {
  activeElement?: { tagName: string }
  hidden: boolean
}

interface FakeBand {
  ahead: ReturnType<typeof vi.fn>
  stir: ReturnType<typeof vi.fn>
  rest: ReturnType<typeof vi.fn>
}

interface FakeStudioInstance {
  context: FakeContext
  inputs: { music: object; weather: object }
  band?: FakeBand
  moveTo: ReturnType<typeof vi.fn>
  turn: ReturnType<typeof vi.fn>
  fade: ReturnType<typeof vi.fn>
  hush: ReturnType<typeof vi.fn>
  hears: ReturnType<typeof vi.fn>
  ahead: ReturnType<typeof vi.fn>
}

interface FakeContext {
  currentTime: number
  resume: ReturnType<typeof vi.fn>
  suspend: ReturnType<typeof vi.fn>
}

const SAMPLE_PLACE: SoundPlace = { key: 2, sky: 'rain', near: 0.6, voice: 'pan' }
const SECOND_PLACE: SoundPlace = { key: 4, sky: 'sea', near: 0.75, voice: 'piano' }

/** A click somewhere on a page of its own. */
let click: (within?: string) => void
let page: FakeDocument
let win: FakeWindow
let stored: Map<string, string>
let sound: typeof Switch
let ear: typeof EarValue
let context: FakeContext
let studios: FakeStudioInstance[]
let bandMake: ReturnType<typeof vi.fn>
let fakeBand: FakeBand

const realSetTimeout = globalThis.setTimeout

async function waitUntil(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await new Promise((resolve) => realSetTimeout(resolve, 0))
  }
  throw new Error('Timed out waiting for async condition')
}

beforeEach(async () => {
  vi.resetModules()
  stored = new Map<string, string>()
  page = Object.assign(new EventTarget(), { hidden: false }) as FakeDocument
  win = Object.assign(new EventTarget(), {
    scrollY: 0,
    setTimeout: (...args: Parameters<typeof globalThis.setTimeout>) => globalThis.setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof globalThis.clearTimeout>) => globalThis.clearTimeout(...args),
    setInterval: (...args: Parameters<typeof globalThis.setInterval>) => globalThis.setInterval(...args),
    clearInterval: (...args: Parameters<typeof globalThis.clearInterval>) => globalThis.clearInterval(...args),
  }) as FakeWindow

  vi.stubGlobal('document', page)
  vi.stubGlobal('window', win)
  vi.stubGlobal('Element', Place)
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  })

  context = {
    currentTime: 10,
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
  }

  studios = []
  fakeBand = {
    ahead: vi.fn(),
    stir: vi.fn(),
    rest: vi.fn(),
  }
  bandMake = vi.fn(async () => fakeBand)

  const localContext = context
  const localStudios = studios
  const localBandMake = bandMake

  vi.doMock('./context', () => ({
    theContext: () => localContext,
  }))
  vi.doMock('./studio', () => ({
    Studio: class MockStudio implements FakeStudioInstance {
      readonly inputs = { music: {}, weather: {} }
      band?: FakeBand
      moveTo = vi.fn()
      turn = vi.fn()
      fade = vi.fn()
      hush = vi.fn()
      hears = vi.fn()
      ahead = vi.fn()
      constructor(readonly context: FakeContext) {
        localStudios.push(this)
      }
    },
  }))
  vi.doMock('./band', () => ({
    Band: { make: localBandMake },
  }))

  click = (within) => {
    const event = new Event('click')
    Object.defineProperty(event, 'target', { value: new Place(within) })
    page.dispatchEvent(event)
  }

  ear = (await import('./ear')).ear
  sound = await import('./switch')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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
    click('.wc-pens')
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

describe('kept, keep, wanted, and want storage handling', () => {
  it('returns ALL by default and merges partial stored settings', () => {
    expect(sound.kept()).toEqual(sound.ALL)

    stored.set('wc-sound', JSON.stringify({ weather: false }))
    expect(sound.kept()).toEqual({ music: true, weather: false, paint: true })

    sound.keep({ music: false, weather: true, paint: false })
    expect(stored.get('wc-sound')).toBe(JSON.stringify({ music: false, weather: true, paint: false }))
    expect(sound.kept()).toEqual({ music: false, weather: true, paint: false })
  })

  it('falls back to ALL when stored JSON is malformed', () => {
    stored.set('wc-sound', '{not-json')
    expect(sound.kept()).toEqual(sound.ALL)
  })

  it('falls back gracefully when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })

    expect(sound.kept()).toEqual(sound.ALL)
    expect(() => sound.keep({ music: false, weather: false, paint: false })).not.toThrow()
    expect(sound.wanted()).toBe(true)
    expect(() => sound.want(false)).not.toThrow()
    expect(() => sound.want(true)).not.toThrow()
  })
})

describe('open, close, listeners, and studio controls', () => {
  it('opens a single studio, configures place/parts/fade, delegates controls, and closes cleanly', async () => {
    vi.useFakeTimers()
    const listener = vi.fn()
    const unlisten = sound.listen(listener)

    expect(sound.sounding()).toBe(false)
    sound.moveTo(SAMPLE_PLACE)
    sound.turn('music', false)
    sound.fade(false)

    await sound.open(SAMPLE_PLACE, { music: true, weather: false, paint: true }, true)
    await waitUntil(() => studios[0]?.band === fakeBand)

    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(studios).toHaveLength(1)
    const studio = studios[0]
    expect(studio.moveTo).toHaveBeenCalledWith(SAMPLE_PLACE)
    expect(studio.turn).toHaveBeenCalledWith('music', true)
    expect(studio.turn).toHaveBeenCalledWith('weather', false)
    expect(studio.turn).toHaveBeenCalledWith('paint', true)
    expect(studio.fade).toHaveBeenCalledWith(true, true)
    expect(studio.hush).not.toHaveBeenCalled()
    expect(bandMake).toHaveBeenCalledWith(context, studio.inputs, SAMPLE_PLACE)
    expect(studio.band).toBe(fakeBand)
    expect(sound.sounding()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    page.hidden = true
    await sound.open(SECOND_PLACE, { music: false, weather: true, paint: false })
    expect(studios).toHaveLength(1)
    expect(studio.moveTo).toHaveBeenLastCalledWith(SECOND_PLACE)
    expect(studio.fade).toHaveBeenLastCalledWith(false, false)
    expect(listener).toHaveBeenCalledTimes(2)

    sound.moveTo(SAMPLE_PLACE)
    sound.turn('paint', true)
    sound.fade(true)
    expect(studio.moveTo).toHaveBeenLastCalledWith(SAMPLE_PLACE)
    expect(studio.turn).toHaveBeenLastCalledWith('paint', true)
    expect(studio.fade).toHaveBeenLastCalledWith(true)

    sound.close()
    expect(sound.sounding()).toBe(false)
    expect(studio.fade).toHaveBeenLastCalledWith(false)
    expect(fakeBand.rest).toHaveBeenCalledTimes(1)
    expect(ear.hears).toBeUndefined()
    expect(ear.hush).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(3)

    unlisten()
    sound.close()
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('cancels an in-flight open when close overtakes it', async () => {
    vi.useFakeTimers()
    let finishResume!: () => void
    context.resume.mockReturnValue(new Promise<void>((resolve) => (finishResume = resolve)))
    const listener = vi.fn()
    sound.listen(listener)

    const opening = sound.open(SAMPLE_PLACE, sound.ALL)
    sound.close()
    expect(listener).toHaveBeenCalledTimes(1)

    finishResume()
    await opening

    expect(studios).toHaveLength(0)
    expect(sound.sounding()).toBe(false)
    expect(ear.hears).toBeUndefined()
    expect(ear.hush).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('cancels an earlier in-flight open when a second open overtakes it', async () => {
    vi.useFakeTimers()
    let finishFirst!: () => void
    let finishSecond!: () => void
    context.resume
      .mockReturnValueOnce(new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockReturnValueOnce(new Promise<void>((resolve) => (finishSecond = resolve)))

    const first = sound.open(SAMPLE_PLACE, { music: false, weather: false, paint: false })
    const second = sound.open(SECOND_PLACE, { music: true, weather: true, paint: true })

    finishFirst()
    await first
    expect(studios).toHaveLength(0)
    expect(sound.sounding()).toBe(false)

    finishSecond()
    await second
    expect(studios).toHaveLength(1)
    expect(studios[0].moveTo).toHaveBeenCalledTimes(1)
    expect(studios[0].moveTo).toHaveBeenCalledWith(SECOND_PLACE)
    expect(studios[0].turn).toHaveBeenCalledWith('music', true)
    expect(sound.sounding()).toBe(true)
  })

  it('wires ear.hears, ear.hush, and hushes immediately when ear.playing is true', async () => {
    vi.useFakeTimers()
    ear.playing = true

    await sound.open(SAMPLE_PLACE, sound.ALL)
    const studio = studios[0]

    expect(studio.hush).toHaveBeenCalledWith(true)

    const heard: Heard = {
      gesture: 'letter',
      pan: -0.25,
      size: 0.4,
      light: 0.6,
      warmth: 0.3,
      lasts: 0.8,
      index: 2,
    }
    ear.hears?.(heard)
    expect(studio.hears).toHaveBeenCalledWith(heard)

    ear.hush?.(false)
    expect(studio.hush).toHaveBeenLastCalledWith(false)

    sound.close()
    expect(ear.hears).toBeUndefined()
    expect(ear.hush).toBeUndefined()
  })

  it('warns and continues playing without band when Band.make fails', async () => {
    vi.useFakeTimers()
    const failure = new Error('engine load failed')
    bandMake.mockRejectedValueOnce(failure)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await sound.open(SAMPLE_PLACE, sound.ALL)
    await waitUntil(() => warn.mock.calls.length > 0)

    expect(warn).toHaveBeenCalledWith('The engine could not be had, so the page plays without it.', failure)
    expect(studios[0].band).toBeUndefined()
    expect(sound.sounding()).toBe(true)

    vi.advanceTimersByTime(250)
    expect(studios[0].ahead).toHaveBeenCalledTimes(2)
  })
})

describe('interval scheduling, scroll stirring, and wc:rain events', () => {
  it('schedules studio.ahead, band.ahead with ear.view, and dispatches wc:rain for rain and chord', async () => {
    vi.useFakeTimers()
    const view: View = { light: 0.7, warmth: 0.4 }
    ear.view = vi.fn(() => view)

    const rains: Event[] = []
    win.addEventListener('wc:rain', (event) => rains.push(event))

    await sound.open(SAMPLE_PLACE, sound.ALL)
    await waitUntil(() => studios[0]?.band === fakeBand)
    const studio = studios[0]

    expect(studio.ahead).toHaveBeenCalledTimes(1)
    expect(studio.ahead).toHaveBeenCalledWith(11.2, expect.any(Function))

    context.currentTime = 10.25
    vi.advanceTimersByTime(250)

    expect(studio.ahead).toHaveBeenCalledTimes(2)
    expect(studio.ahead).toHaveBeenLastCalledWith(11.45, expect.any(Function))
    expect(fakeBand.ahead).toHaveBeenCalledTimes(1)
    expect(fakeBand.ahead).toHaveBeenCalledWith(view, expect.any(Function))

    const rainCb = studio.ahead.mock.calls[1][1] as (at: number) => void
    rainCb(10.65)
    rainCb(9.0)

    vi.advanceTimersByTime(0)
    expect(rains).toHaveLength(1)

    vi.advanceTimersByTime(399)
    expect(rains).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(rains).toHaveLength(2)

    rains.length = 0
    const chordCb = fakeBand.ahead.mock.calls[0][1] as () => void
    chordCb()

    vi.advanceTimersByTime(0)
    expect(rains).toHaveLength(1)
    vi.advanceTimersByTime(499)
    expect(rains).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(rains).toHaveLength(2)
    vi.advanceTimersByTime(590)
    expect(rains).toHaveLength(2)
    vi.advanceTimersByTime(10)
    expect(rains).toHaveLength(3)

    const callsBeforeClose = studio.ahead.mock.calls.length
    sound.close()
    vi.advanceTimersByTime(1000)
    expect(studio.ahead).toHaveBeenCalledTimes(callsBeforeClose)
  })

  it('stirs band on scroll, clamps at 1, decays across ticks, and stops listening on close', async () => {
    vi.useFakeTimers()
    win.scrollY = 200
    await sound.open(SAMPLE_PLACE, sound.ALL)
    await waitUntil(() => studios[0]?.band === fakeBand)

    win.scrollY = 900
    win.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(250)
    expect(fakeBand.stir).toHaveBeenLastCalledWith(expect.closeTo(0.4, 5))

    win.scrollY = 5000
    win.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(250)
    expect(fakeBand.stir).toHaveBeenLastCalledWith(expect.closeTo(0.8, 5))

    for (let i = 0; i < 25; i++) vi.advanceTimersByTime(250)
    const settledCalls = fakeBand.stir.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(fakeBand.stir).toHaveBeenCalledTimes(settledCalls)

    sound.close()
    win.scrollY = 0
    win.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(500)
    expect(fakeBand.stir).toHaveBeenCalledTimes(settledCalls)
  })
})

describe('delayed suspend and givesWay while sounding', () => {
  it('suspends the AudioContext 900ms after close', async () => {
    vi.useFakeTimers()
    await sound.open(SAMPLE_PLACE, sound.ALL)

    sound.close()
    vi.advanceTimersByTime(899)
    expect(context.suspend).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(context.suspend).toHaveBeenCalledTimes(1)
  })

  it('skips suspend when reopened before 900ms', async () => {
    vi.useFakeTimers()
    await sound.open(SAMPLE_PLACE, sound.ALL)

    sound.close()
    vi.advanceTimersByTime(500)
    await sound.open(SAMPLE_PLACE, sound.ALL)
    vi.advanceTimersByTime(500)

    expect(context.suspend).not.toHaveBeenCalled()
  })

  it('skips suspend when ear.playing is true at 900ms', async () => {
    vi.useFakeTimers()
    await sound.open(SAMPLE_PLACE, sound.ALL)

    sound.close()
    ear.playing = true
    vi.advanceTimersByTime(900)

    expect(context.suspend).not.toHaveBeenCalled()
  })

  it('closes active sound when window blurs onto an IFRAME, and ignores non-IFRAME blurs', async () => {
    vi.useFakeTimers()
    await sound.open(SAMPLE_PLACE, sound.ALL)
    const studio = studios[0]

    page.activeElement = { tagName: 'BUTTON' }
    win.dispatchEvent(new Event('blur'))
    expect(sound.sounding()).toBe(true)

    page.activeElement = { tagName: 'IFRAME' }
    win.dispatchEvent(new Event('blur'))
    expect(sound.sounding()).toBe(false)
    expect(studio.fade).toHaveBeenLastCalledWith(false)
    expect(ear.hears).toBeUndefined()

    const start = vi.fn()
    sound.arm(start)
    click()
    expect(start).not.toHaveBeenCalled()
  })
})
