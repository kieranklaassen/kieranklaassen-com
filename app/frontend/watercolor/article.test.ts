// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { around, book, paintedTitle, river, wide } from './article'
import { PAPER, type Composition, type Page, type PaintBox } from './compose'
import { Cutter } from './mask'
import { Kind, type RGB, type Rect, type Wash } from './painter'
import { seeded } from './pigments'

function setRect(element: Element, rect: Rect) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.w,
    bottom: rect.y + rect.h,
    width: rect.w,
    height: rect.h,
    toJSON: () => ({}),
  } as DOMRect)
}

function makeBox(name: string, rect: Rect, key = name, element: HTMLElement = document.createElement('div')): PaintBox {
  setRect(element, rect)
  return { name, key, element, ...rect }
}

function makeShell(width: number, height: number): HTMLElement {
  const shell = document.createElement('div')
  setRect(shell, { x: 0, y: 0, w: width, h: height })
  return shell
}

function expectValidRgb(rgb: RGB) {
  expect(rgb).toHaveLength(3)
  for (const ch of rgb) {
    expect(Number.isFinite(ch)).toBe(true)
    expect(ch).toBeGreaterThanOrEqual(0)
    expect(ch).toBeLessThanOrEqual(1)
  }
}

function expectValidWashes(washes: Wash[]) {
  expect(washes.length).toBeGreaterThan(0)
  for (const wash of washes) {
    expect(wash.w).toBeGreaterThan(0)
    expect(wash.h).toBeGreaterThan(0)
    expect(Number.isFinite(wash.x)).toBe(true)
    expect(Number.isFinite(wash.y)).toBe(true)
    expect(wash.density).toBeGreaterThan(0)
    expectValidRgb(wash.ink)
    expectValidRgb(wash.ink2)
    expect(wash.seed).toHaveLength(4)
  }
}

function expectSameBytes(actual: Uint8Array, expected: Uint8Array) {
  expect(actual).toBeInstanceOf(Uint8Array)
  expect(expected).toBeInstanceOf(Uint8Array)
  expect(actual.length).toBe(expected.length)
  const len = actual.length
  const words = len >>> 2
  const alignedBytes = words << 2
  if ((actual.byteOffset & 3) === 0 && (expected.byteOffset & 3) === 0) {
    const a32 = new Uint32Array(actual.buffer, actual.byteOffset, words)
    const b32 = new Uint32Array(expected.buffer, expected.byteOffset, words)
    for (let i = 0; i < words; i++) {
      if (a32[i] !== b32[i]) {
        const start = i << 2
        for (let j = start; j < start + 4; j++) {
          if (actual[j] !== expected[j]) {
            expect(actual[j], `mask.field byte mismatch at index ${j}`).toBe(expected[j])
          }
        }
      }
    }
  } else {
    for (let i = 0; i < alignedBytes; i++) {
      if (actual[i] !== expected[i]) {
        expect(actual[i], `mask.field byte mismatch at index ${i}`).toBe(expected[i])
      }
    }
  }
  for (let i = alignedBytes; i < len; i++) {
    if (actual[i] !== expected[i]) {
      expect(actual[i], `mask.field byte mismatch at index ${i}`).toBe(expected[i])
    }
  }
}

function expectSameComposition(actual: Composition, expected: Composition) {
  const { mask: actualMask, ...actualRest } = actual
  const { mask: expectedMask, ...expectedRest } = expected
  expect(actualRest).toEqual(expectedRest)
  if (!actualMask || !expectedMask) {
    expect(actualMask).toEqual(expectedMask)
    return
  }
  const { field: actualField, ...actualMaskRest } = actualMask
  const { field: expectedField, ...expectedMaskRest } = expectedMask
  expect(actualMaskRest).toEqual(expectedMaskRest)
  expectSameBytes(actualField, expectedField)
}

const originalRangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')

function stubCanvasAndRanges(defaultShapeBox: Rect = { x: 20, y: 15, w: 60, h: 40 }) {
  class FakePath2D {
    readonly d: string
    constructor(d = '') {
      this.d = d
    }
  }
  vi.stubGlobal('Path2D', FakePath2D)

  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Range) {
      const owner = this.startContainer.parentElement
      const parentRect = owner?.getBoundingClientRect() ?? { left: 0, top: 0, width: 200, height: 60 }
      const left = parentRect.left + this.startOffset * 18
      const top = parentRect.top + 4
      const width = 16
      const height = Math.max(24, parentRect.height * 0.7)
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({}),
      } as DOMRect
    },
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    const canvas = this
    let tx = 0
    let ty = 0
    let sx = 1
    let sy = 1
    let composite = 'source-over'
    let buffer = new Uint8ClampedArray(Math.max(1, canvas.width * canvas.height) * 4)

    const ensureBuffer = () => {
      const size = Math.max(1, canvas.width * canvas.height) * 4
      if (buffer.length !== size) buffer = new Uint8ClampedArray(size)
    }

    const rasterize = (box: Rect) => {
      ensureBuffer()
      const x0 = Math.max(0, Math.floor(box.x * sx + tx))
      const y0 = Math.max(0, Math.floor(box.y * sy + ty))
      const x1 = Math.min(canvas.width, Math.ceil((box.x + box.w) * sx + tx))
      const y1 = Math.min(canvas.height, Math.ceil((box.y + box.h) * sy + ty))
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) buffer[(y * canvas.width + x) * 4 + 3] = 255
    }

    return {
      font: '400 48px serif',
      textBaseline: 'alphabetic',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      get globalCompositeOperation() {
        return composite
      },
      set globalCompositeOperation(value: string) {
        composite = value
      },
      setTransform(a: number, _b: number, _c: number, d: number, e: number, f: number) {
        sx = a
        sy = d
        tx = e
        ty = f
      },
      translate(dx: number, dy: number) {
        tx += dx * sx
        ty += dy * sy
      },
      scale(fx: number, fy: number) {
        sx *= fx
        sy *= fy
      },
      clearRect() {
        ensureBuffer()
        buffer.fill(0)
      },
      measureText(text: string) {
        return { width: Math.max(10, text.length * 16), fontBoundingBoxAscent: 36 }
      },
      fillText(_text: string, x: number, y: number) {
        rasterize({ x, y: Math.max(0, y - 28), w: 14, h: 28 })
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill() {
        if (composite === 'destination-out') return
        rasterize(defaultShapeBox)
      },
      stroke() {
        rasterize(defaultShapeBox)
      },
      getImageData(x: number, y: number, w: number, h: number) {
        ensureBuffer()
        const out = new Uint8ClampedArray(w * h * 4)
        for (let row = 0; row < h; row++)
          for (let col = 0; col < w; col++) {
            const src = ((y + row) * canvas.width + (x + col)) * 4
            const dst = (row * w + col) * 4
            out[dst + 3] = buffer[src + 3] ?? 0
          }
        return { data: out }
      },
    } as unknown as CanvasRenderingContext2D
  })
}

function makeTitleBox(text: string, rect: Rect, key = 'capturing-flow', fontSize = '64px'): PaintBox {
  const el = document.createElement('h1')
  el.textContent = text
  el.style.fontSize = fontSize
  el.style.fontFamily = 'Newsreader'
  return makeBox('title', rect, key, el)
}

interface ArticleFixtureOptions {
  width: number
  height: number
  slug?: string
  titleText?: string
  includeInitial?: boolean
  includeTailAndRules?: boolean
  includeFoot?: boolean
  includeStream?: boolean
  includeWander?: boolean
}

function makeArticlePage(opts: ArticleFixtureOptions): Page {
  const { width, height, slug = 'capturing-flow', titleText = 'Quiet River' } = opts
  const narrow = width < 900
  const shell = makeShell(width, height)

  const proseX = narrow ? 24 : Math.round((width - 620) / 2)
  const proseW = narrow ? width - 48 : 620
  const proseY = 560
  const proseH = height - proseY - 180

  const prose = document.createElement('div')
  prose.className = 'wc-prose'
  setRect(prose, { x: proseX, y: proseY, w: proseW, h: proseH })

  const p1 = document.createElement('p')
  p1.textContent = 'First paragraph of the essay.'
  setRect(p1, { x: proseX, y: proseY, w: proseW, h: 90 })

  const h2 = document.createElement('h2')
  h2.textContent = 'First Section'
  setRect(h2, { x: proseX, y: proseY + 140, w: proseW, h: 40 })

  const p2 = document.createElement('p')
  p2.textContent = 'Second paragraph with details.'
  setRect(p2, { x: proseX, y: proseY + 210, w: proseW, h: 120 })

  const h3 = document.createElement('h3')
  h3.textContent = 'Second Section'
  setRect(h3, { x: proseX, y: proseY + 420, w: proseW, h: 36 })

  const p3 = document.createElement('p')
  p3.textContent = 'Closing paragraph of the essay.'
  setRect(p3, { x: proseX, y: proseY + 490, w: proseW, h: 120 })

  if (opts.includeWander) {
    h2.dataset.wander = ''
    p2.dataset.wander = ''
  }

  prose.append(p1, h2, p2, h3, p3)
  shell.appendChild(prose)

  const title = makeTitleBox(titleText, { x: proseX, y: 120, w: proseW, h: 80 }, slug)
  const picture = makeBox('picture', { x: proseX, y: 240, w: proseW, h: 260 }, slug)
  const nav = makeBox('nav', { x: 24, y: 20, w: width - 48, h: 40 }, 'nav')
  const boxes: PaintBox[] = [nav, title, picture]

  if (opts.includeInitial) {
    const initialEl = document.createElement('span')
    initialEl.textContent = 'F'
    initialEl.style.fontSize = '72px'
    boxes.push(makeBox('initial', { x: proseX, y: proseY, w: 68, h: 72 }, slug, initialEl))
  }

  if (opts.includeTailAndRules) {
    boxes.push(
      makeBox('tail', { x: proseX + proseW / 2 - 50, y: proseY + proseH + 20, w: 100, h: 100 }, slug),
      makeBox('rule', { x: proseX, y: proseY + proseH + 140, w: proseW, h: 3 }, 'rule-1'),
    )
  }

  if (opts.includeFoot) {
    boxes.push(makeBox('foot', { x: 0, y: height - 160, w: width, h: 150 }, slug))
  }

  if (opts.includeStream) {
    boxes.push(makeBox('stream', { x: proseX, y: 0, w: proseW, h: height }, slug))
  }

  return {
    width,
    height,
    shell,
    boxes: () => boxes,
    random: seeded(42),
  }
}

afterEach(() => {
  if (originalRangeRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalRangeRect)
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('paintedTitle', () => {
  it('returns [] when lettersOf finds no text or when 2d canvas context is unavailable', () => {
    stubCanvasAndRanges()
    const shell = makeShell(1000, 600)
    const page: Page = { width: 1000, height: 600, shell, boxes: () => [], random: seeded(1) }

    const emptyBox = makeTitleBox('   \n\t  ', { x: 80, y: 60, w: 300, h: 70 })
    expect(paintedTitle(emptyBox, page, new Cutter(), seeded(1))).toEqual([])

    vi.restoreAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const textBox = makeTitleBox('Hello', { x: 80, y: 60, w: 300, h: 70 })
    expect(paintedTitle(textBox, page, new Cutter(), seeded(1))).toEqual([])
  })

  it('produces Kind.Letter washes with sequential indices, monotonic delays, valid bounds/colors, and font-size density', () => {
    stubCanvasAndRanges()
    const shell = makeShell(1000, 600)
    const page: Page = { width: 1000, height: 600, shell, boxes: () => [], random: seeded(7) }

    const smallTitle = makeTitleBox('Ab c', { x: 100, y: 80, w: 300, h: 64 }, 'capturing-flow', '64px')
    const cutterA = new Cutter()
    const cutterB = new Cutter()
    const first = paintedTitle(smallTitle, page, cutterA, seeded(7), 300)
    const second = paintedTitle(smallTitle, page, cutterB, seeded(7), 300)

    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expectValidWashes(first)

    first.forEach((wash, i) => {
      expect(wash.kind).toBe(Kind.Letter)
      expect(wash.index).toBe(i)
      expect(wash.delay).toBe(300 + i * 60)
      expect(wash.density).toBe(1.4)
      expect(wash.lasts).toBe(1300)
      expect(wash.grow).toBe(0)
      expect(wash.field).toBeCloseTo(64 * 0.09, 5)
      expect(wash.extra).toHaveLength(4)
      expect(wash.from).toHaveLength(2)
    })

    const mask = cutterA.sheet()
    expect(mask).toBeDefined()
    expect(mask!.width).toBe(2048)
    expect(mask!.height).toBeGreaterThan(0)

    const longBigTitle = makeTitleBox('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234', { x: 40, y: 80, w: 800, h: 120 }, 'capturing-flow', '104px')
    const longWashes = paintedTitle(longBigTitle, page, new Cutter(), seeded(9), 100)
    expect(longWashes).toHaveLength(30)
    expect(longWashes.every((w) => w.density === 1.15)).toBe(true)
    expect(longWashes[1].delay! - longWashes[0].delay!).toBeCloseTo(1400 / 30, 5)
  })
})

describe('article compositions', () => {
  it('book composes deterministic framed plate, title, initial, vignettes, and rules with PAPER and mask', () => {
    stubCanvasAndRanges()
    const opts: ArticleFixtureOptions = {
      width: 1200,
      height: 1600,
      includeInitial: true,
      includeTailAndRules: true,
    }

    const a = book(makeArticlePage(opts))
    const b = book(makeArticlePage(opts))

    expectSameComposition(a, b)
    expect(a.paper).toEqual(PAPER)
    expect(a.course).toBeUndefined()
    expect(a.mask).toBeDefined()
    expect(a.mask!.field.length).toBe(a.mask!.width * a.mask!.height)
    expectValidWashes(a.washes)
    expect(a.washes.some((w) => w.kind === Kind.Pencil)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Square)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Letter)).toBe(true)

    const narrow = book(makeArticlePage({ ...opts, width: 600, height: 1500 }))
    expect(narrow.paper).toEqual(PAPER)
    expect(narrow.mask).toBeDefined()
    expectValidWashes(narrow.washes)
  })

  it('wide composes deterministic full-bleed header, margin vignettes, and footer on wide and narrow viewports', () => {
    stubCanvasAndRanges()
    const wideOpts: ArticleFixtureOptions = {
      width: 1280,
      height: 1600,
      includeFoot: true,
    }

    const a = wide(makeArticlePage(wideOpts))
    const b = wide(makeArticlePage(wideOpts))

    expectSameComposition(a, b)
    expect(a.paper).toEqual(PAPER)
    expect(a.course).toBeUndefined()
    expect(a.mask).toBeDefined()
    expectValidWashes(a.washes)
    expect(a.washes.some((w) => w.kind === Kind.Square)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Letter)).toBe(true)

    const proseLeft = Math.round((wideOpts.width - 620) / 2)
    expect(a.washes.some((w) => w.y > 520 && w.y < wideOpts.height - 200 && w.x < proseLeft)).toBe(true)

    const narrow = wide(makeArticlePage({ ...wideOpts, width: 580, height: 1500 }))
    expect(narrow.paper).toEqual(PAPER)
    expect(narrow.mask).toBeDefined()
    expectValidWashes(narrow.washes)
    expect(narrow.washes.some((w) => w.y > 540 && w.y < 1300)).toBe(false)
  })

  it('around composes deterministic title, plate, brush drops, and margin details on wide and narrow viewports', () => {
    stubCanvasAndRanges()
    const wideOpts: ArticleFixtureOptions = {
      width: 1400,
      height: 2000,
    }

    const a = around(makeArticlePage(wideOpts))
    const b = around(makeArticlePage(wideOpts))

    expectSameComposition(a, b)
    expect(a.paper).toEqual(PAPER)
    expect(a.course).toBeUndefined()
    expect(a.mask).toBeDefined()
    expectValidWashes(a.washes)
    expect(a.washes.some((w) => w.kind === Kind.Puddle && w.still === true)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Letter)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Square)).toBe(true)

    const narrow = around(makeArticlePage({ width: 580, height: 1600 }))
    expect(narrow.paper).toEqual(PAPER)
    expect(narrow.mask).toBeDefined()
    expectValidWashes(narrow.washes)
  })

  it('river composes deterministic banks, course, wandering prose, and details on wide and narrow viewports', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    stubCanvasAndRanges()

    const wideOpts: ArticleFixtureOptions = {
      width: 1280,
      height: 1600,
      includeStream: true,
      includeWander: true,
    }

    const pageA = makeArticlePage(wideOpts)
    const a = river(pageA)
    const b = river(makeArticlePage(wideOpts))

    expectSameComposition(a, b)
    expect(a.paper).toEqual(PAPER)
    expect(a.mask).toBeDefined()
    expect(a.course).toBeDefined()
    expect(a.course!.step).toBeGreaterThan(0)
    expect(a.course!.points.length).toBeGreaterThan(0)
    expectValidWashes(a.washes)
    expect(a.washes.some((w) => w.kind === Kind.Bank)).toBe(true)
    expect(a.washes.some((w) => w.kind === Kind.Letter)).toBe(true)

    const wandered = [...pageA.shell.querySelectorAll<HTMLElement>('[data-wander]')]
    expect(wandered.some((el) => el.style.translate !== '')).toBe(true)

    const narrowPage = makeArticlePage({ width: 580, height: 1500, includeWander: true })
    const preWandered = narrowPage.shell.querySelector<HTMLElement>('[data-wander]')!
    preWandered.style.translate = '12px 0'
    const narrow = river(narrowPage)

    expect(preWandered.style.translate).toBe('')
    expect(narrow.paper).toEqual(PAPER)
    expect(narrow.course).toBeDefined()
    expect(narrow.course!.points.length).toBeGreaterThan(0)
    expect(narrow.mask).toBeDefined()
    expectValidWashes(narrow.washes)
    expect(narrow.washes.some((w) => w.kind === Kind.Bank)).toBe(true)
  })
})
