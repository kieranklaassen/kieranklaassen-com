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

  it('does not compose or paint when restored() or leave() occurs while Promise<Compose> is still pending', async () => {
    const { shell, sheet } = makeSheet()
    const compose = vi.fn<Compose>(() => ({ washes: [makeWash()], paper: [1, 1, 1] }))
    const composeReady = deferred<Compose>()

    const leave = track(laySheet(sheet, composeReady.promise, 29))!
    painterReady.resolve(true)
    fontsReady.resolve()
    await flushMicrotasks()

    fakePainter.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(fakePainter.setUp).toHaveBeenCalledTimes(1)
    expect(runFrames(500)).toBe(1)
    expect(compose).not.toHaveBeenCalled()
    expect(fakePainter.paint).not.toHaveBeenCalled()
    expect(sheet.querySelectorAll('canvas')).toHaveLength(0)
    expect(shell.dataset.painted).toBeUndefined()

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
})
