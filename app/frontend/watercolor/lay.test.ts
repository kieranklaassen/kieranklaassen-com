// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ear } from '../sound/ear'
import type { Compose, Composition } from './compose'
import { laySheet, seedOfVisit } from './lay'
import { Kind, Painter, type Wash } from './painter'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((r, j) => {
    resolve = r
    reject = j
  })
  return { promise, resolve, reject }
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function makeWash(overrides: Partial<Wash> = {}): Wash {
  return {
    kind: Kind.Square,
    x: 40,
    y: 40,
    w: 120,
    h: 120,
    ink: [0.2, 0.4, 0.7],
    ink2: [0.3, 0.5, 0.8],
    density: 0.8,
    seed: [1, 2, 3, 4],
    grow: 0,
    ...overrides,
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }
}

interface FakePainter {
  canvas: HTMLCanvasElement
  ready: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  setPaper: ReturnType<typeof vi.fn>
  setCourse: ReturnType<typeof vi.fn>
  setMask: ReturnType<typeof vi.fn>
  setUp: ReturnType<typeof vi.fn>
  paint: ReturnType<typeof vi.fn>
}

let reducedMotion = false
let fontsReady: Deferred<void>
let painterReady: Deferred<boolean>
let fakePainter: FakePainter
let rafId = 0
let rafQueue: Map<number, FrameRequestCallback>
let cancelRafSpy: ReturnType<typeof vi.fn<(id: number) => void>>
let originalFonts: PropertyDescriptor | undefined
let cleanups: (() => void)[]

function runFrames(now = 1000) {
  const pending = [...rafQueue.entries()]
  rafQueue.clear()
  for (const [, cb] of pending) cb(now)
  return pending.length
}

function track(leave: (() => void) | undefined) {
  if (leave) cleanups.push(leave)
  return leave
}

function makeSheet({ width = 1000, height = 800 }: { width?: number; height?: number } = {}) {
  const shell = document.createElement('div')
  const sheet = document.createElement('div')
  shell.append(sheet)
  document.body.append(shell)

  Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(shell, 'scrollHeight', { configurable: true, value: height })
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  })
  return { shell, sheet }
}

beforeEach(() => {
  reducedMotion = false
  fontsReady = deferred<void>()
  painterReady = deferred<boolean>()
  FakeResizeObserver.instances = []
  cleanups = []
  rafId = 0
  rafQueue = new Map()
  cancelRafSpy = vi.fn((id: number) => {
    rafQueue.delete(id)
  })

  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafId
    rafQueue.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', cancelRafSpy)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })

  originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: fontsReady.promise },
  })

  const fake2d = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
    kind === '2d' ? fake2d : null) as HTMLCanvasElement['getContext'])

  fakePainter = {
    canvas: document.createElement('canvas'),
    ready: vi.fn(() => painterReady.promise),
    setPaper: vi.fn(),
    setCourse: vi.fn(),
    setMask: vi.fn(),
    setUp: vi.fn(),
    paint: vi.fn(),
  }
  vi.spyOn(Painter, 'get').mockReturnValue(fakePainter as unknown as Painter)

  ear.view = undefined
  ear.hears = undefined
  window.history.replaceState({}, '', '/')
  document.body.innerHTML = ''
})

afterEach(() => {
  for (const leave of cleanups) leave()
  cleanups = []
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else delete (document as { fonts?: unknown }).fonts
  ear.view = undefined
  ear.hears = undefined
  window.history.replaceState({}, '', '/')
  document.body.innerHTML = ''
})

describe('seedOfVisit', () => {
  it('returns the numeric seed query parameter when provided', () => {
    window.history.replaceState({}, '', '/?seed=42')
    expect(seedOfVisit()).toBe(42)

    window.history.replaceState({}, '', '/?foo=bar&seed=0')
    expect(seedOfVisit()).toBe(0)
  })

  it('falls back to a bounded random integer when no seed parameter is present', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(seedOfVisit()).toBe(2 ** 30)

    window.history.replaceState({}, '', '/?seed=')
    expect(seedOfVisit()).toBe(2 ** 30)
  })
})

describe('laySheet', () => {
  it('returns undefined when sheet has no parent element', () => {
    const detached = document.createElement('div')
    const compose = vi.fn<Compose>()

    expect(laySheet(detached, compose, 7)).toBeUndefined()
    expect(compose).not.toHaveBeenCalled()
    expect(ear.view).toBeUndefined()
  })

  it('returns undefined when Painter.get() is unavailable', () => {
    vi.spyOn(Painter, 'get').mockReturnValue(undefined)
    const { sheet } = makeSheet()
    const compose = vi.fn<Compose>()

    expect(laySheet(sheet, compose, 7)).toBeUndefined()
    expect(compose).not.toHaveBeenCalled()
    expect(ear.view).toBeUndefined()
  })

  it('waits for both painter.ready() and document.fonts.ready before laying and painting tiles', async () => {
    const { shell, sheet } = makeSheet({ width: 1000, height: 800 })
    const wash = makeWash({ x: 50, y: 50, w: 100, h: 100 })
    const compose = vi.fn<Compose>(() => ({
      washes: [wash],
      paper: [0.97, 0.95, 0.91],
    }))

    const leave = track(laySheet(sheet, compose, 123))!
    expect(leave).toBeTypeOf('function')

    painterReady.resolve(true)
    await flushMicrotasks()
    expect(compose).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()

    fontsReady.resolve()
    await flushMicrotasks()

    expect(compose).toHaveBeenCalledTimes(1)
    expect(fakePainter.setPaper).toHaveBeenCalledWith([0.97, 0.95, 0.91])
    expect(sheet.querySelectorAll('canvas')).toHaveLength(2)
    expect(shell.dataset.painted).toBe('')
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledWith(shell)

    expect(runFrames(1000)).toBe(1)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)
    expect(wash.grow).toBeGreaterThan(0)

    leave()
  })

  it('does not wait indefinitely when document.fonts.ready stalls', async () => {
    vi.useFakeTimers()
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))

    const leave = track(laySheet(sheet, compose, 9))!
    painterReady.resolve(true)
    await Promise.resolve()
    expect(compose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2500)

    expect(compose).toHaveBeenCalledTimes(1)
    expect(shell.dataset.painted).toBe('')
    expect(sheet.querySelectorAll('canvas').length).toBeGreaterThan(0)

    leave()
  })

  it('calls leave and tears down listeners when shader linking fails', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))

    track(laySheet(sheet, compose, 11))
    expect(ear.view).toBeTypeOf('function')

    painterReady.resolve(false)
    fontsReady.resolve()
    await flushMicrotasks()

    expect(compose).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()
    expect(ear.view).toBeUndefined()
    expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('scroll'))
    expect(rafQueue.size).toBe(0)

    const lostEvent = new Event('webglcontextlost', { cancelable: true })
    fakePainter.canvas.dispatchEvent(lostEvent)
    expect(lostEvent.defaultPrevented).toBe(false)

    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(fakePainter.setUp).not.toHaveBeenCalled()
  })

  it('treats early frame() ticks and bare-paper clicks before tiles exist as harmless', async () => {
    const { shell, sheet } = makeSheet()
    const hears = vi.fn()
    ear.hears = hears
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))

    const leave = track(laySheet(sheet, compose, 17))!

    window.dispatchEvent(new Event('scroll'))
    expect(rafQueue.size).toBe(1)
    expect(() => runFrames(100)).not.toThrow()
    expect(fakePainter.paint).not.toHaveBeenCalled()
    expect(rafQueue.size).toBe(0)

    shell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 500, clientY: 500 }))
    expect(hears).not.toHaveBeenCalled()
    expect(rafQueue.size).toBe(0)

    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()
    runFrames(200)
    runFrames(2200)
    expect(rafQueue.size).toBe(0)
    hears.mockClear()

    shell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 500, clientY: 500 }))
    expect(hears).toHaveBeenCalledWith(expect.objectContaining({ gesture: 'splash' }))
    expect(rafQueue.size).toBe(1)

    leave()
  })

  it('says when it is laid, once what it composes stands where it will', async () => {
    const { shell, sheet } = makeSheet()
    const order: string[] = []
    shell.addEventListener('wc:laid', () => order.push('laid'))
    track(
      laySheet(
        sheet,
        () => {
          order.push('composed')
          return { washes: [makeWash()], paper: [1, 1, 1] }
        },
        17,
      ),
    )
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()
    expect(order.slice(0, 2)).toEqual(['composed', 'laid'])
  })

  it.each(['wc-ink', 'wc-pens'])('throws no paint and drops no water where it is drawn on (%s)', async (name) => {
    const { shell, sheet } = makeSheet()
    const drawn = document.createElement('div')
    drawn.className = name
    shell.append(drawn)
    const hears = vi.fn()
    ear.hears = hears
    track(laySheet(sheet, () => ({ washes: [makeWash()], paper: [1, 1, 1] }), 17))
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()
    runFrames(200)
    runFrames(2200)
    hears.mockClear()

    drawn.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 500, clientY: 500 }))
    drawn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 80, clientY: 80 }))
    expect(hears).not.toHaveBeenCalled()

    shell.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 80, clientY: 80 }))
    expect(hears).toHaveBeenCalledWith(expect.objectContaining({ gesture: 'drop' }))
  })

  it('tears down cleanly without painting if unmounted before ready() resolves', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))

    const leave = track(laySheet(sheet, compose, 21))!
    leave()

    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    expect(compose).not.toHaveBeenCalled()
    expect(fakePainter.setPaper).not.toHaveBeenCalled()
    expect(fakePainter.paint).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()
    expect(FakeResizeObserver.instances[0].observe).not.toHaveBeenCalled()
  })

  it('settles washes immediately under prefers-reduced-motion without animation or splash listeners', async () => {
    reducedMotion = true
    const { shell, sheet } = makeSheet()
    const floodEl = document.createElement('a')
    shell.append(floodEl)
    const normalWash = makeWash({ x: 20, y: 20, w: 100, h: 100 })
    const floodWash = makeWash({ x: 200, y: 200, w: 100, h: 100, flood: floodEl })
    const compose = vi.fn<Compose>(() => ({
      washes: [normalWash, floodWash],
      paper: [0.97, 0.95, 0.91],
    }))

    const leave = track(laySheet(sheet, compose, 33))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    expect(normalWash.grow).toBe(1)
    expect(floodWash.grow).toBe(0)

    runFrames(500)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)
    expect(rafQueue.size).toBe(0)

    const hears = vi.fn()
    ear.hears = hears
    shell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 600, clientY: 600 }))
    window.dispatchEvent(new Event('wc:again'))
    expect(hears).not.toHaveBeenCalled()
    expect(normalWash.grow).toBe(1)
    expect(rafQueue.size).toBe(0)

    leave()
  })

  it('handles WebGL context loss and restore by calling painter.setUp() and re-painting tiles', async () => {
    const { sheet } = makeSheet()
    const washes = [makeWash({ x: 10, y: 10, w: 100, h: 100 })]
    const compose = vi.fn<Compose>((): Composition => ({
      washes: washes.map((w) => ({ ...w })),
      paper: [0.96, 0.94, 0.9],
    }))

    const leave = track(laySheet(sheet, compose, 55))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    runFrames(1000)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)
    runFrames(3000)
    expect(rafQueue.size).toBe(0)
    fakePainter.paint.mockClear()

    const lost = new Event('webglcontextlost', { cancelable: true })
    fakePainter.canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)

    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(fakePainter.setUp).toHaveBeenCalledTimes(1)
    expect(rafQueue.size).toBe(1)

    runFrames(3100)
    expect(compose).toHaveBeenCalledTimes(2)
    expect(fakePainter.setPaper).toHaveBeenCalledTimes(2)
    expect(rafQueue.size).toBe(1)

    runFrames(3200)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)

    leave()
  })

  it('cleanup removes listeners, disconnects observer, cancels pending rAFs, clears ear.view, and removes tiles', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))

    const leave = track(laySheet(sheet, compose, 77))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    const pendingFrameId = [...rafQueue.keys()][0]
    expect(pendingFrameId).toBeDefined()
    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    const pendingComposeId = [...rafQueue.keys()][1]
    expect(pendingComposeId).toBeDefined()

    expect(sheet.querySelectorAll('canvas')).toHaveLength(2)
    expect(shell.dataset.painted).toBe('')
    expect(ear.view).toBeTypeOf('function')

    leave()

    expect(cancelRafSpy).toHaveBeenCalledWith(pendingFrameId)
    expect(cancelRafSpy).toHaveBeenCalledWith(pendingComposeId)
    expect(rafQueue.size).toBe(0)
    expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()
    expect(ear.view).toBeUndefined()

    fakePainter.setUp.mockClear()
    const hears = vi.fn()
    ear.hears = hears
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('wc:rain'))
    window.dispatchEvent(new Event('wc:again'))
    shell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 500, clientY: 500 }))
    const lost = new Event('webglcontextlost', { cancelable: true })
    fakePainter.canvas.dispatchEvent(lost)
    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))

    expect(rafQueue.size).toBe(0)
    expect(hears).not.toHaveBeenCalled()
    expect(lost.defaultPrevented).toBe(false)
    expect(fakePainter.setUp).not.toHaveBeenCalled()
  })

  it('waits for a deferred Promise<Compose> that resolves after painter.ready() and fonts.ready, then paints normally', async () => {
    const { shell, sheet } = makeSheet({ width: 1000, height: 800 })
    const wash = makeWash({ x: 50, y: 50, w: 100, h: 100 })
    const compose = vi.fn<Compose>(() => ({
      washes: [wash],
      paper: [0.97, 0.95, 0.91],
    }))
    const composeReady = deferred<Compose>()

    const leave = track(laySheet(sheet, composeReady.promise, 123))!

    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    expect(compose).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()
    expect(FakeResizeObserver.instances[0].observe).not.toHaveBeenCalled()

    composeReady.resolve(compose)
    await flushMicrotasks()

    expect(compose).toHaveBeenCalledTimes(1)
    expect(fakePainter.setPaper).toHaveBeenCalledWith([0.97, 0.95, 0.91])
    expect(sheet.querySelectorAll('canvas')).toHaveLength(2)
    expect(shell.dataset.painted).toBe('')
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledWith(shell)

    expect(runFrames(1000)).toBe(1)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)
    expect(wash.grow).toBeGreaterThan(0)

    leave()
  })

  it('tears down listeners, ResizeObserver, and ear.view via leave() when Promise<Compose> rejects', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason)
    window.addEventListener('unhandledrejection', onUnhandled)

    try {
      const { shell, sheet } = makeSheet()
      const composeReady = deferred<Compose>()

      track(laySheet(sheet, composeReady.promise, 19))
      expect(ear.view).toBeTypeOf('function')

      painterReady.resolve(true)
      fontsReady.resolve()
      composeReady.reject(new Error('composer chunk failed'))
      await flushMicrotasks()

      expect(unhandled).toEqual([])
      expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
      expect(shell.dataset.painted).toBeUndefined()
      expect(ear.view).toBeUndefined()
      expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)

      window.dispatchEvent(new Event('scroll'))
      expect(rafQueue.size).toBe(0)

      const lostEvent = new Event('webglcontextlost', { cancelable: true })
      fakePainter.canvas.dispatchEvent(lostEvent)
      expect(lostEvent.defaultPrevented).toBe(false)

      fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
      expect(fakePainter.setUp).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  })

  it('does not double-lay or skip observer.observe(shell) when restored() fires while Promise<Compose> is pending, then repaints on restore after started', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))
    const composeReady = deferred<Compose>()

    const leave = track(laySheet(sheet, composeReady.promise, 29))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(fakePainter.setUp).toHaveBeenCalledTimes(1)
    expect(rafQueue.size).toBe(0)
    expect(compose).not.toHaveBeenCalled()
    expect(fakePainter.paint).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()

    composeReady.resolve(compose)
    await flushMicrotasks()

    expect(compose).toHaveBeenCalledTimes(1)
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledTimes(1)
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledWith(shell)
    expect(shell.dataset.painted).toBe('')
    expect(runFrames(500)).toBe(1)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)
    runFrames(2500)
    fakePainter.paint.mockClear()

    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(fakePainter.setUp).toHaveBeenCalledTimes(2)
    expect(rafQueue.size).toBe(1)

    runFrames(2600)
    expect(compose).toHaveBeenCalledTimes(2)
    expect(rafQueue.size).toBe(1)

    runFrames(2700)
    expect(fakePainter.paint).toHaveBeenCalledTimes(2)

    leave()
  })

  it('does not compose or paint when leave() is called while Promise<Compose> is pending', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))
    const composeReady = deferred<Compose>()

    const leave = track(laySheet(sheet, composeReady.promise, 31))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    leave()
    composeReady.resolve(compose)
    await flushMicrotasks()
    runFrames(600)

    expect(compose).not.toHaveBeenCalled()
    expect(fakePainter.setPaper).not.toHaveBeenCalled()
    expect(fakePainter.paint).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()
    expect(ear.view).toBeUndefined()
    expect(FakeResizeObserver.instances[0].observe).not.toHaveBeenCalled()
  })

  it('suppresses unhandled rejection when Promise<Compose> rejects after early return on detached sheet or missing painter', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason)
    window.addEventListener('unhandledrejection', onUnhandled)

    try {
      const detached = document.createElement('div')
      const detachedCompose = deferred<Compose>()
      expect(laySheet(detached, detachedCompose.promise, 7)).toBeUndefined()
      detachedCompose.reject(new Error('detached rejection'))

      vi.spyOn(Painter, 'get').mockReturnValue(undefined)
      const { sheet } = makeSheet()
      const missingPainterCompose = deferred<Compose>()
      expect(laySheet(sheet, missingPainterCompose.promise, 8)).toBeUndefined()
      missingPainterCompose.reject(new Error('missing painter rejection'))

      await flushMicrotasks()
      expect(unhandled).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  })

  describe('once it is laid', () => {
    async function laid(washes: Wash[]) {
      const { shell, sheet } = makeSheet()
      const leave = track(laySheet(sheet, () => ({ washes, paper: [1, 1, 1] }), 17))!
      painterReady.resolve(true)
      fontsReady.resolve()
      await flushMicrotasks()
      runFrames(0)
      runFrames(5000)
      vi.spyOn(performance, 'now').mockReturnValue(10_000)
      vi.mocked(sheet.getBoundingClientRect).mockReturnValue({ ...sheet.getBoundingClientRect(), left: 10, top: 20 })
      return { shell, leave }
    }

    const point = (type: string, clientX = 0, clientY = 0) => new PointerEvent(type, { bubbles: true, clientX, clientY })

    it('drops water on the topmost open wash under the pointer', async () => {
      const below = makeWash()
      const open = makeWash()
      const still = makeWash({ still: true })
      await laid([below, open, still])
      const hears = vi.fn()
      ear.hears = hears

      window.dispatchEvent(point('pointerdown', 90, 120))
      vi.mocked(performance.now).mockReturnValue(10_500)
      window.dispatchEvent(point('pointerdown', 100, 120))
      runFrames(10_500 + 1700)

      expect(open.drop).toEqual([90, 100, 48, 1])
      expect(below.drop).toBeUndefined()
      expect(still.drop).toBeUndefined()
      expect(rafQueue.size).toBe(0)
      expect(hears).toHaveBeenCalledTimes(2)
      const heard = hears.mock.calls[0][0]
      expect(heard.gesture).toBe('drop')
      expect(heard.light).toBeCloseTo(0.4)
      expect(heard.warmth).toBeCloseTo(0.05)
    })

    it('takes a point on the left and top edge of a wash for in it, and on the right and bottom edge for out', async () => {
      await laid([makeWash()])
      const hears = vi.fn()
      ear.hears = hears
      const on = (x: number, y: number) => {
        hears.mockClear()
        window.dispatchEvent(point('pointerdown', x + 10, y + 20))
        return hears.mock.calls.length
      }
      expect([on(40, 40), on(159, 159), on(39, 40), on(40, 39), on(160, 40), on(40, 160)]).toEqual([1, 1, 0, 0, 0, 0])
    })

    it('rains on an open wash, choosing the wash before the place', async () => {
      const rainedOn = makeWash({ x: 100, y: 100, w: 100, h: 200 })
      await laid([makeWash(), rainedOn, makeWash({ still: true })])
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.25).mockReturnValueOnce(0.75)

      window.dispatchEvent(new Event('wc:rain'))
      runFrames(10_000 + 1700)

      expect(Math.random).toHaveBeenCalledTimes(3)
      expect(rainedOn.drop).toEqual([140, 220, 28, 0.9])
    })

    it('drops water on a stroke that sounded, and later on its other voices, in place of any drop there', async () => {
      const staff = document.createElement('div')
      const stroke = document.createElement('i')
      staff.dataset.paint = 'staff'
      staff.append(stroke)
      const own = makeWash({ x: 100, y: 100, w: 20, h: 40, stands: stroke })
      const mirrored = makeWash({ x: 100, y: 260, w: 20, h: 40 })
      const { shell } = await laid([own, mirrored])
      shell.append(staff)
      vi.spyOn(staff, 'getBoundingClientRect').mockReturnValue({ ...staff.getBoundingClientRect(), top: 120, height: 200 })

      window.dispatchEvent(point('pointerdown', 120, 300)) // the drop that is to fall takes the place of this one
      stroke.dispatchEvent(new Event('wc:heard', { bubbles: true }))
      runFrames(10_059)
      expect(own.drop?.[0]).toBe(110)
      expect(mirrored.drop).toBeUndefined()

      runFrames(10_060 + 1700)
      expect(own.drop).toEqual([110, 120, 20, 1])
      expect(mirrored.drop).toEqual([110, 280, 16.8, 1.1])
    })

    it('leads to what the pressed square stands for', async () => {
      const to = document.createElement('p')
      to.scrollIntoView = vi.fn()
      const { shell } = await laid([makeWash({ leads: to })])
      const article = document.createElement('div')
      article.dataset.of = 'article'
      shell.append(article)

      article.dispatchEvent(point('click', 400, 400))
      expect(to.scrollIntoView).not.toHaveBeenCalled()
      article.dispatchEvent(point('click', 100, 120))
      expect(to.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    })

    it('floods from where the pointer came in, and dries when it goes', async () => {
      const link = document.createElement('a')
      const wash = makeWash({ flood: link })
      const { shell } = await laid([wash])
      shell.append(link)

      link.dispatchEvent(point('pointerover', 80, 150))
      runFrames(10_900)
      expect(wash.from).toEqual([0.25, 0.75])
      expect(wash.grow).toBe(1)

      link.dispatchEvent(point('pointerout'))
      runFrames(10_500)
      expect(wash.grow).toBe(0)
    })

    it('weighs the light and warmth of what the window holds', async () => {
      await laid([makeWash({ w: 100, h: 100, ink: [1, 1, 1] }), makeWash({ w: 100, h: 300, ink: [0.5, 0, 0] }), makeWash({ kind: Kind.Pencil, ink: [0, 0, 1] })])
      const view = ear.view?.()
      expect(view?.light).toBeCloseTo((1 + 3 * 0.15) / 4)
      expect(view?.warmth).toBeCloseTo((0.5 + 3 * 0.95) / 4)
    })

    it('listens to nothing after it leaves', async () => {
      const link = document.createElement('a')
      const { shell, leave } = await laid([makeWash({ flood: link, stands: link }), makeWash()])
      const staff = document.createElement('div')
      staff.dataset.paint = 'staff'
      staff.append(link)
      shell.append(staff)
      const hears = vi.fn()
      ear.hears = hears
      leave()

      window.dispatchEvent(point('pointermove', 100, 120))
      window.dispatchEvent(point('pointerdown', 100, 120))
      for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout', 'wc:heard', 'click']) link.dispatchEvent(point(type, 100, 120))

      expect(hears).not.toHaveBeenCalled()
      expect(performance.now).not.toHaveBeenCalled()
      expect(rafQueue.size).toBe(0)
    })
  })
})
