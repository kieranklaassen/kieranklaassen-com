// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PAPER,
  banks,
  beside,
  courseAt,
  courseOf,
  courseRound,
  estuary,
  grown,
  letterInk,
  longPage,
  meets,
  mosaic,
  noteInk,
  of,
  paintedName,
  pencil,
  ruled,
  score,
  smallSquares,
  still,
  tide,
  toneOf,
  wander,
  winding,
  writtenIn,
  type Page,
  type PaintBox,
} from './compose'
import { Kind, type RGB, type Rect, type Wash } from './painter'
import { seeded } from './pigments'

function makeBox(name: string, rect: Rect, key = name, element = document.createElement('div')): PaintBox {
  setRect(element, rect)
  return { name, key, element, ...rect }
}

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

function makeShell(width: number, height: number): HTMLElement {
  const shell = document.createElement('div')
  setRect(shell, { x: 0, y: 0, w: width, h: height })
  Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width })
  return shell
}

const originalRangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')

const DEFAULT_SHAPE_BOX: Rect = { x: 20, y: 15, w: 60, h: 40 }

function stubCanvasAndRanges() {
  const fillTextCalls: string[] = []

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
      const fs = parseFloat(owner ? getComputedStyle(owner).fontSize : '') || 48
      const step = Math.max(18, Math.round(fs * 0.65))
      const left = parentRect.left + this.startOffset * step
      const top = parentRect.top + 4
      const width = Math.max(14, Math.round(fs * 0.5))
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
    let font = '400 48px serif'
    let tx = 0
    let ty = 0
    let sx = 1
    let sy = 1
    let composite = 'source-over'
    let cw = canvas.width
    let ch = canvas.height
    let alpha = new Uint8Array(Math.max(1, cw * ch))

    const fontSize = () => {
      const match = /(\d+(?:\.\d+)?)px/.exec(font)
      return match ? parseFloat(match[1]) : 48
    }

    const syncDimensions = () => {
      cw = canvas.width
      ch = canvas.height
      const size = Math.max(1, cw * ch)
      if (alpha.length !== size) alpha = new Uint8Array(size)
    }

    const rasterize = (box: Rect) => {
      syncDimensions()
      const x0 = Math.max(0, Math.floor(box.x * sx + tx))
      const y0 = Math.max(0, Math.floor(box.y * sy + ty))
      const x1 = Math.min(cw, Math.ceil((box.x + box.w) * sx + tx))
      const y1 = Math.min(ch, Math.ceil((box.y + box.h) * sy + ty))
      if (x0 >= x1 || y0 >= y1) return
      for (let y = y0; y < y1; y++) alpha.fill(255, y * cw + x0, y * cw + x1)
    }

    return {
      get font() {
        return font
      },
      set font(value: string) {
        font = value
      },
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
        syncDimensions()
        alpha.fill(0)
      },
      measureText(text: string) {
        const fs = fontSize()
        return { width: Math.max(10, text.length * fs * 0.55), fontBoundingBoxAscent: fs * 0.75 }
      },
      fillText(text: string, x: number, y: number) {
        fillTextCalls.push(text)
        const fs = fontSize()
        const h = fs * 0.7
        rasterize({ x, y: Math.max(0, y - h), w: Math.max(12, fs * 0.45), h })
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill() {
        if (composite === 'destination-out') return
        rasterize(DEFAULT_SHAPE_BOX)
      },
      stroke() {
        rasterize(DEFAULT_SHAPE_BOX)
      },
      getImageData(x: number, y: number, w: number, h: number) {
        syncDimensions()
        const out = new Uint8ClampedArray(w * h * 4)
        for (let row = 0; row < h; row++) {
          const srcRow = (y + row) * cw + x
          let dst = row * w * 4 + 3
          for (let col = 0; col < w; col++, dst += 4) {
            const a = alpha[srcRow + col]
            if (a) out[dst] = a
          }
        }
        return { data: out }
      },
    } as unknown as CanvasRenderingContext2D
  })

  return { fillTextCalls }
}

function makeTextBox(
  name: 'name' | 'title',
  text: string,
  rect: Rect,
  { key = name, fontSize = '100px', textTransform = '' }: { key?: string; fontSize?: string; textTransform?: string } = {},
): PaintBox {
  const el = document.createElement('h1')
  el.textContent = text
  el.style.fontSize = fontSize
  el.style.fontFamily = 'Newsreader'
  if (textTransform) el.style.textTransform = textTransform
  return makeBox(name, rect, key, el)
}

function makePhraseBox(rect: Rect, key = 'capturing-flow'): PaintBox {
  const el = document.createElement('div')
  el.dataset.strong = 'Warm water'
  el.dataset.pale = 'quiet notes'
  return makeBox('phrase', rect, key, el)
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

afterEach(() => {
  if (originalRangeRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalRangeRect)
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rectangle geometry helpers', () => {
  it('grown expands or shrinks symmetrically around the box center', () => {
    const box = { x: 20, y: 30, w: 100, h: 60 }
    expect(grown(box, 10)).toEqual({ x: 10, y: 20, w: 120, h: 80 })
    expect(grown(box, 0)).toEqual(box)
    expect(grown(box, -5)).toEqual({ x: 25, y: 35, w: 90, h: 50 })
  })

  it('meets detects positive-area overlap and excludes touching edges and corners', () => {
    const a = { x: 10, y: 10, w: 20, h: 20 }
    expect(meets(a, { x: 20, y: 20, w: 20, h: 20 })).toBe(true)
    expect(meets(a, { x: 12, y: 12, w: 5, h: 5 })).toBe(true)
    expect(meets(a, a)).toBe(true)

    expect(meets(a, { x: 30, y: 10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: -10, y: 10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 10, y: 30, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 10, y: -10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 30, y: 30, w: 20, h: 20 })).toBe(false)

    const separated = { x: 100, y: 100, w: 10, h: 10 }
    expect(meets(a, separated)).toBe(false)
    expect(meets(separated, a)).toBe(false)
  })

  it('beside leaves untouched cells intact and respects the least-size boundary', () => {
    const cell = { x: 0, y: 0, w: 40, h: 30 }
    expect(beside(cell, [], 20)).toEqual(cell)
    expect(beside(cell, [{ x: 40, y: 0, w: 20, h: 30 }], 20)).toEqual(cell)
    expect(beside(cell, [], 30)).toEqual(cell)
    expect(beside(cell, [], 31)).toBeUndefined()
  })

  it('beside picks the largest remaining piece around one or multiple obstacles', () => {
    const cell = { x: 0, y: 0, w: 100, h: 100 }

    expect(beside(cell, [{ x: 0, y: 0, w: 30, h: 100 }], 10)).toEqual({ x: 30, y: 0, w: 70, h: 100 })
    expect(beside(cell, [{ x: 0, y: 0, w: 30, h: 40 }], 10)).toEqual({ x: 30, y: 0, w: 70, h: 100 })

    const taken: Rect[] = [
      { x: 0, y: 0, w: 30, h: 100 },
      { x: 25, y: 0, w: 75, h: 40 },
      { x: 75, y: 35, w: 30, h: 70 },
    ]
    const result = beside(cell, taken, 15)
    expect(result).toEqual({ x: 30, y: 40, w: 45, h: 60 })
    for (const t of taken) expect(meets(result!, t)).toBe(false)
  })

  it('beside returns undefined when obstacles consume or shrink the cell below least', () => {
    const cell = { x: 10, y: 10, w: 50, h: 50 }
    expect(beside(cell, [{ x: 0, y: 0, w: 100, h: 100 }], 1)).toBeUndefined()
    expect(beside(cell, [{ x: 10, y: 10, w: 38, h: 50 }], 15)).toBeUndefined()
    expect(beside(cell, [{ x: 10, y: 10, w: 38, h: 50 }], 12)).toEqual({ x: 48, y: 10, w: 12, h: 50 })
  })

  it('of filters paint boxes by one or more names in original order', () => {
    const boxes = [
      makeBox('card', { x: 0, y: 0, w: 10, h: 10 }, 'c1'),
      makeBox('nav', { x: 0, y: 20, w: 10, h: 10 }, 'n1'),
      makeBox('repo', { x: 0, y: 40, w: 10, h: 10 }, 'r1'),
      makeBox('card', { x: 0, y: 60, w: 10, h: 10 }, 'c2'),
    ]
    expect(of(boxes, 'card').map((b) => b.key)).toEqual(['c1', 'c2'])
    expect(of(boxes, 'card', 'repo').map((b) => b.key)).toEqual(['c1', 'r1', 'c2'])
    expect(of(boxes, 'missing')).toEqual([])
  })
})

describe('ruled, pencil, toneOf, noteInk, and letterInk', () => {
  it('ruled splits horizontal and vertical lines around taken boxes and drops tiny spans', () => {
    const horizontal = ruled(
      { x: 0, y: 50, w: 300, h: 3 },
      [
        { x: 200, y: 40, w: 40, h: 30 },
        { x: 80, y: 40, w: 30, h: 30 },
        { x: 10, y: 100, w: 50, h: 20 },
      ],
      seeded(1),
    )
    expect(horizontal.map(({ x, w, kind }) => ({ x, w, kind }))).toEqual([
      { x: 0, w: 80, kind: Kind.Pencil },
      { x: 110, w: 90, kind: Kind.Pencil },
      { x: 240, w: 60, kind: Kind.Pencil },
    ])

    const vertical = ruled(
      { x: 40, y: 0, w: 3, h: 140 },
      [{ x: 20, y: 20, w: 40, h: 30 }],
      seeded(2),
    )
    expect(vertical.map(({ y, h, kind }) => ({ y, h, kind }))).toEqual([{ y: 50, h: 90, kind: Kind.Pencil }])
    expect(vertical[0].still).toBe(true)
  })

  it('pencil produces a still pencil wash with a four-value seed', () => {
    const wash = pencil({ x: 5, y: 10, w: 120, h: 3 }, seeded(9))
    expect(wash.kind).toBe(Kind.Pencil)
    expect(wash.still).toBe(true)
    expect(wash.seed).toHaveLength(4)
  })

  it('toneOf and noteInk are deterministic and stay in expected ranges', () => {
    const keys = ['capturing-flow', 'tool-tailor', 'enthusiasm', 'unlocking-ideas', 'whispers-of-silece-ep']
    for (const key of keys) {
      const tone = toneOf(key)
      expect(toneOf(key)).toEqual(tone)
      expect(tone.light).toBeGreaterThanOrEqual(0.04)
      expect(tone.light).toBeLessThanOrEqual(0.46)
      expect(tone.warmth < 0.3 || tone.warmth >= 0.7).toBe(true)

      const [ink, ink2] = noteInk(key)
      expect(noteInk(key)).toEqual([ink, ink2])
      expectValidRgb(ink)
      expectValidRgb(ink2)
    }
  })

  it('letterInk produces valid RGB pairs including for single-letter titles', () => {
    const [a, b] = letterInk(0, 1, 0.3)
    expectValidRgb(a)
    expectValidRgb(b)
    expect(letterInk(0, 1, 0.3)).toEqual([a, b])

    for (let i = 0; i < 6; i++) {
      const [ink, ink2] = letterInk(i, 6, 0.4)
      expectValidRgb(ink)
      expectValidRgb(ink2)
    }
  })
})

describe('winding, tide, courseOf, courseAt, courseRound, and banks', () => {
  it('winding and tide stay bounded within [-1, 1]', () => {
    const values = Array.from({ length: 100 }, (_, i) => winding(i * 45))
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(1)

    vi.useFakeTimers()
    for (const hours of [0, 3.1, 6.2, 9.3, 12.42]) {
      vi.setSystemTime(hours * 3_600_000)
      const t = tide()
      expect(t).toBeGreaterThanOrEqual(-1)
      expect(t).toBeLessThanOrEqual(1)
    }
    vi.setSystemTime(0)
    expect(tide()).toBeCloseTo(0, 10)
    vi.setSystemTime((12.42 / 4) * 3_600_000)
    expect(tide()).toBeCloseTo(1, 10)
  })

  it('courseOf samples at step 12 for normal heights, scales step for tall pages, and courseAt interpolates and clamps', () => {
    const course = courseOf(120, (y) => [200 + y, 50 + y * 0.5])
    expect(course.step).toBe(12)
    expect(courseAt(course, 0)).toEqual([200, 50])
    expect(courseAt(course, 12)).toEqual([212, 56])
    const mid = courseAt(course, 18)
    expect(mid[0]).toBeCloseTo(218, 4)
    expect(mid[1]).toBeCloseTo(59, 4)

    expect(courseAt(course, -50)).toEqual([200, 50])
    const far = courseAt(course, 99999)
    expect(Number.isFinite(far[0])).toBe(true)
    expect(Number.isFinite(far[1])).toBe(true)

    const tall = courseOf(40000, (y) => [500, 100 + y * 0.01])
    expect(tall.step).toBe(20)
  })

  it('courseRound stays narrow on bare paper and widens around written blocks', () => {
    const bare = courseRound([], 400, 600)
    expect(bare.step).toBe(12)
    const [, bareHalf] = courseAt(bare, 300)
    expect(bareHalf).toBeCloseTo(9, 1)

    const block: Rect = { x: 100, y: 200, w: 200, h: 120 }
    const around = courseRound([block], 400, 600)
    const [midAtBlock, halfAtBlock] = courseAt(around, 260)
    expect(midAtBlock).toBeCloseTo(200, 1)
    expect(halfAtBlock).toBeGreaterThanOrEqual(125)

    const [, halfAway] = courseAt(around, 540)
    expect(halfAway).toBeLessThan(20)

    const fullWidth = courseRound([{ x: 20, y: 200, w: 360, h: 120 }], 400, 600)
    const [, fullHalf] = courseAt(fullWidth, 260)
    expect(fullHalf).toBeGreaterThan(250)
  })

  it('banks generates deterministic Kind.Bank washes with left/right flow direction', () => {
    const course = courseOf(500, () => [500, 200])
    const first = banks({ width: 1000, top: 0, foot: 500, course, random: seeded(11) })
    const second = banks({ width: 1000, top: 0, foot: 500, course, random: seeded(11) })
    expect(first).toEqual(second)
    expectValidWashes(first)
    expect(first.every((w) => w.kind === Kind.Bank)).toBe(true)
    expect(first.some((w) => w.from?.[0] === 0)).toBe(true)
    expect(first.some((w) => w.from?.[0] === 1)).toBe(true)
  })
})

describe('DOM helpers and Compose functions', () => {
  it('wander offsets [data-wander] elements and still resets them', () => {
    const shell = makeShell(1000, 600)
    const item = document.createElement('div')
    item.dataset.wander = ''
    setRect(item, { x: 300, y: 100, w: 400, h: 80 })
    shell.appendChild(item)

    wander(shell, (y) => 500 + y * 0.1, 1000)
    expect(item.style.translate).toBe('14.0px 0')

    still(shell)
    expect(item.style.translate).toBe('')
  })

  it('writtenIn swaps sheet for prose blocks once prose blocks are present', () => {
    const shell = makeShell(400, 600)
    const boxes = [
      makeBox('sheet', { x: 10, y: 10, w: 380, h: 500 }),
      makeBox('heading', { x: 20, y: 20, w: 200, h: 30 }),
    ]
    expect(writtenIn(boxes, shell)).toHaveLength(2)

    const prose = document.createElement('div')
    prose.className = 'wc-prose'
    const p = document.createElement('p')
    setRect(p, { x: 24, y: 80, w: 350, h: 60 })
    prose.appendChild(p)
    shell.appendChild(prose)

    const rects = writtenIn(boxes, shell)
    expect(rects).toHaveLength(2)
    expect(rects).toContainEqual({ x: 24, y: 80, w: 350, h: 60 })
    expect(rects).not.toContainEqual(expect.objectContaining({ x: 10, y: 10, w: 380, h: 500 }))
  })

  it('smallSquares is deterministic, respects cards/bare zones, and adapts on narrow viewports', () => {
    const shell = makeShell(1000, 700)
    const card = makeBox('card', { x: 120, y: 120, w: 240, h: 140 }, 'card-1')
    const sheet = makeBox('sheet', { x: 440, y: 120, w: 260, h: 160 }, 'sheet-1')
    const bare = makeBox('name', { x: 350, y: 20, w: 300, h: 70 }, 'name')

    const makePage = (): Page => ({
      width: 1000,
      height: 700,
      shell,
      boxes: () => [card, sheet, bare],
      random: seeded(99),
    })

    const a = smallSquares(makePage())
    const b = smallSquares(makePage())
    expect(a).toEqual(b)
    expect(a.paper).toEqual(PAPER)
    expectValidWashes(a.washes)

    expect(a.washes[0]).toMatchObject({ x: card.x, y: card.y, w: card.w, h: card.h, kind: Kind.Square })
    expect(a.washes[1]).toMatchObject({ x: sheet.x, y: sheet.y, w: sheet.w, h: sheet.h, density: 0.3 })
    expect(a.washes.some((w) => w.kind === Kind.Pencil)).toBe(true)

    const netSquares = a.washes.slice(2).filter((w) => w.kind === Kind.Square)
    expect(netSquares.length).toBeGreaterThan(0)
    for (const sq of netSquares) expect(meets(sq, bare)).toBe(false)

    const band = makeBox('band', { x: 0, y: 200, w: 500, h: 120 }, 'band-1')
    const narrow = smallSquares({
      width: 500,
      height: 600,
      shell: makeShell(500, 600),
      boxes: () => [band],
      random: seeded(99),
    })
    expectValidWashes(narrow.washes)
    expect(narrow.washes.some((w) => w.kind === Kind.Pencil)).toBe(false)
    for (const sq of narrow.washes) expect(meets(sq, band)).toBe(true)
  })

  it('estuary is deterministic and builds a course and banks for both wide and narrow layouts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)

    const shell = makeShell(1200, 800)
    const stream = makeBox('stream', { x: 300, y: 0, w: 600, h: 800 })
    const makeWide = (): Page => ({
      width: 1200,
      height: 800,
      shell,
      boxes: () => [stream],
      random: seeded(5),
    })

    const wideA = estuary(makeWide())
    const wideB = estuary(makeWide())
    expect(wideA).toEqual(wideB)
    expect(wideA.paper).toEqual(PAPER)
    expect(wideA.course).toBeDefined()
    expectValidWashes(wideA.washes)

    const narrow = estuary({
      width: 600,
      height: 700,
      shell: makeShell(600, 700),
      boxes: () => [makeBox('heading', { x: 80, y: 120, w: 440, h: 60 })],
      random: seeded(5),
    })
    expect(narrow.course).toBeDefined()
    expectValidWashes(narrow.washes)
  })

  it('score composes deterministic washes from swatches, staff, notes, ticks, and phrases', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const staffEl = document.createElement('div')
    staffEl.dataset.lanes = '4'
    const phraseWordsEl = document.createElement('div')
    phraseWordsEl.dataset.strong = 'Warm water color'
    phraseWordsEl.dataset.pale = 'quiet notes'

    const article = document.createElement('article')
    const phraseArticleEl = document.createElement('div')
    phraseArticleEl.dataset.of = 'article'
    const prose = document.createElement('div')
    prose.className = 'wc-prose'
    const h2 = document.createElement('h2')
    h2.textContent = 'Opening'
    const p = document.createElement('p')
    p.textContent = 'First sentence here. Does a question glow red? Final sentence.'
    prose.append(h2, p)
    article.append(phraseArticleEl, prose)

    const scoreBoxes: PaintBox[] = [
      makeBox('swatch', { x: 20, y: 20, w: 18, h: 18 }, 'capturing-flow'),
      makeBox('staff', { x: 40, y: 80, w: 600, h: 160 }, 'staff', staffEl),
      makeBox('note', { x: 120, y: 100, w: 40, h: 24 }, 'tool-tailor'),
      makeBox('tick', { x: 200, y: 80, w: 2, h: 160 }, '2024'),
      makeBox('phrase', { x: 40, y: 280, w: 400, h: 20 }, 'capturing-flow', phraseWordsEl),
      makeBox('phrase', { x: 40, y: 320, w: 400, h: 50 }, 'tool-tailor', phraseArticleEl),
    ]

    const makeScorePage = (): Page => ({
      width: 800,
      height: 500,
      shell: makeShell(800, 500),
      boxes: () => scoreBoxes,
      random: seeded(23),
    })

    const scoreA = score(makeScorePage())
    const scoreB = score(makeScorePage())
    expect(scoreA).toEqual(scoreB)
    expect(scoreA.paper).toEqual(PAPER)
    expectValidWashes(scoreA.washes)
    expect(scoreA.washes.some((w) => w.stands === scoreBoxes[2].element)).toBe(true)
    expect(scoreA.washes.some((w) => w.leads === h2)).toBe(true)
    expect(scoreA.washes.some((w) => w.leads === p)).toBe(true)
    expect(scoreA.washes.some((w) => w.kind === Kind.Pencil)).toBe(true)
  })

  it('paintedName and longPage compose line, swatch, and rule washes and add estuary banks when a stream exists', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const lineEl = document.createElement('div')
    const ruleBox = makeBox('rule', { x: 40, y: 240, w: 500, h: 2 }, 'rule-1')
    const swatchBox = makeBox('swatch', { x: 20, y: 100, w: 16, h: 16 }, 'enthusiasm')
    const lineBox = makeBox('line', { x: 40, y: 96, w: 300, h: 28 }, 'enthusiasm', lineEl)

    const paintedShort = paintedName({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [lineBox, swatchBox, ruleBox],
      random: seeded(31),
    })
    expectValidWashes(paintedShort.washes)
    expect(paintedShort.washes.some((w) => w.flood === lineEl)).toBe(true)
    expect(paintedShort.washes.some((w) => w.kind === Kind.Pencil)).toBe(true)

    const paintedLong = paintedName({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [lineBox, swatchBox, ruleBox],
      random: seeded(31),
      long: true,
    })
    expect(paintedLong.washes.length).toBe(paintedShort.washes.length - 1)

    const fallback = longPage({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [lineBox, swatchBox, ruleBox],
      random: seeded(31),
    })
    expect(fallback.course).toBeUndefined()
    expect(fallback.washes).toEqual(paintedShort.washes)

    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const withStream = longPage({
      width: 1200,
      height: 900,
      shell: makeShell(1200, 900),
      boxes: () => [makeBox('stream', { x: 300, y: 200, w: 600, h: 600 }), lineBox, ruleBox],
      random: seeded(31),
    })
    expect(withStream.course).toBeDefined()
    expect(withStream.washes.some((w) => w.kind === Kind.Bank)).toBe(true)
    expect(withStream.washes.some((w) => w.flood === lineEl)).toBe(true)
  })

  it('score renders picture boxes via plate into washes and a non-empty mask', () => {
    stubCanvasAndRanges()

    const pictureBox = makeBox('picture', { x: 40, y: 60, w: 320, h: 200 }, 'capturing-flow')
    const makePage = (): Page => ({
      width: 800,
      height: 500,
      shell: makeShell(800, 500),
      boxes: () => [pictureBox],
      random: seeded(41),
    })

    const first = score(makePage())
    const second = score(makePage())
    expect(first.paper).toEqual(PAPER)
    expect(first.washes).toEqual(second.washes)
    expectValidWashes(first.washes)
    expect(first.washes.some((w) => w.kind === Kind.Square)).toBe(true)
    expect(first.washes.some((w) => w.kind === Kind.Letter)).toBe(true)

    expect(first.mask).toBeDefined()
    expect(second.mask).toBeDefined()
    expect(first.mask!.width).toBe(2048)
    expect(first.mask!.height).toBeGreaterThan(0)
    expect(first.mask!.field.length).toBe(first.mask!.width * first.mask!.height)
    expect(first.mask!.field.some((v) => v > 0)).toBe(true)
    expect(first.mask!.field.length).toBe(second.mask!.field.length)
    expect(first.mask!.field.every((v, i) => v === second.mask!.field[i])).toBe(true)
  })
})

describe('mosaic and linesOf', () => {
  it('returns only sheetWashes and PAPER when no name box exists or 2d context is unavailable', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const phrase = makePhraseBox({ x: 40, y: 260, w: 320, h: 20 })
    const sheetOnly = score({
      width: 800,
      height: 400,
      shell: makeShell(800, 400),
      boxes: () => [phrase],
      random: seeded(17),
    }).washes
    getContextSpy.mockClear()

    const noName = mosaic({
      width: 800,
      height: 400,
      shell: makeShell(800, 400),
      boxes: () => [phrase],
      random: seeded(17),
    })
    expect(noName).toEqual({ washes: sheetOnly, paper: PAPER })
    expect(getContextSpy).not.toHaveBeenCalled()

    const name = makeTextBox('name', 'Kieran', { x: 80, y: 60, w: 400, h: 100 })
    const noContext = mosaic({
      width: 800,
      height: 400,
      shell: makeShell(800, 400),
      boxes: () => [phrase, name],
      random: seeded(17),
    })
    expect(noContext).toEqual({ washes: sheetOnly, paper: PAPER })
    expect(getContextSpy).toHaveBeenCalledWith('2d', { willReadFrequently: true })
  })

  it('bails out early on narrow viewports when name sits inside [data-small]', () => {
    stubCanvasAndRanges()

    const phrase = makePhraseBox({ x: 20, y: 220, w: 320, h: 20 })
    const container = document.createElement('div')
    container.dataset.small = ''
    const name = makeTextBox('name', 'ki ra', { x: 40, y: 40, w: 320, h: 80 }, { fontSize: '60px' })
    container.appendChild(name.element)

    const narrowSmall = mosaic({
      width: 500,
      height: 400,
      shell: makeShell(500, 400),
      boxes: () => [phrase, name],
      random: seeded(29),
    })
    const sheetOnly = mosaic({
      width: 500,
      height: 400,
      shell: makeShell(500, 400),
      boxes: () => [phrase],
      random: seeded(29),
    })
    expect(narrowSmall).toEqual(sheetOnly)
    expect(narrowSmall.washes.length).toBeGreaterThan(0)

    const wideWithSmallAttr = mosaic({
      width: 900,
      height: 400,
      shell: makeShell(900, 400),
      boxes: () => [phrase, name],
      random: seeded(29),
    })
    expect(wideWithSmallAttr.washes.length).toBeGreaterThan(sheetOnly.washes.length)
  })

  it('renders deterministic inside and outside Kind.Square washes on wide and narrow viewports, handling uppercase, whitespace, and sheetWashes', () => {
    const { fillTextCalls } = stubCanvasAndRanges()

    const phrase = makePhraseBox({ x: 40, y: 260, w: 360, h: 20 })
    const wideName = makeTextBox('name', ' ki \n\tra ', { x: 80, y: 60, w: 600, h: 160 }, { fontSize: '160px', textTransform: 'uppercase' })

    const makeWide = (): Page => ({
      width: 900,
      height: 400,
      shell: makeShell(900, 400),
      boxes: () => [phrase, wideName],
      random: seeded(53),
    })

    const sheetOnly = mosaic({
      width: 900,
      height: 400,
      shell: makeShell(900, 400),
      boxes: () => [phrase],
      random: seeded(53),
    }).washes

    const wideA = mosaic(makeWide())
    expect(fillTextCalls).toEqual(['K', 'I', 'R', 'A'])

    const wideB = mosaic(makeWide())
    expect(wideA).toEqual(wideB)
    expect(wideA.paper).toEqual(PAPER)
    expectValidWashes(wideA.washes)
    expect(wideA.washes.slice(0, sheetOnly.length)).toEqual(sheetOnly)

    const wideMosaic = wideA.washes.slice(sheetOnly.length)
    expect(wideMosaic.length).toBeGreaterThan(0)
    expect(wideMosaic.every((w) => w.kind === Kind.Square)).toBe(true)
    const wideInside = wideMosaic.filter((w) => w.density >= 1)
    const wideOutside = wideMosaic.filter((w) => w.density < 0.85)
    expect(wideInside.length).toBeGreaterThan(0)
    expect(wideOutside.length).toBeGreaterThan(0)
    expect(wideInside.every((w) => (w.delay ?? 0) >= 900)).toBe(true)
    expect(wideMosaic.some((w) => w.extra?.[1] === 1)).toBe(true)
    expect(wideMosaic.some((w) => w.extra?.[1] === 0)).toBe(true)

    fillTextCalls.length = 0
    const narrowName = makeTextBox('name', 'ki ra', { x: 40, y: 50, w: 320, h: 70 }, { fontSize: '60px' })
    const makeNarrow = (): Page => ({
      width: 500,
      height: 360,
      shell: makeShell(500, 360),
      boxes: () => [phrase, narrowName],
      random: seeded(61),
    })
    const narrowSheetOnly = mosaic({
      width: 500,
      height: 360,
      shell: makeShell(500, 360),
      boxes: () => [phrase],
      random: seeded(61),
    }).washes

    const narrowA = mosaic(makeNarrow())
    expect(fillTextCalls).toEqual(['k', 'i', 'r', 'a'])
    const narrowB = mosaic(makeNarrow())
    expect(narrowA).toEqual(narrowB)
    expectValidWashes(narrowA.washes)
    expect(narrowA.washes.slice(0, narrowSheetOnly.length)).toEqual(narrowSheetOnly)

    const narrowMosaic = narrowA.washes.slice(narrowSheetOnly.length)
    expect(narrowMosaic.every((w) => w.kind === Kind.Square)).toBe(true)
    expect(narrowMosaic.some((w) => w.density >= 1)).toBe(true)
    expect(narrowMosaic.some((w) => w.density < 0.85)).toBe(true)
  })
})

describe('paintedName with letter rasterization', () => {
  it('rasterizes Kind.Letter washes for large/small name and title boxes with deterministic title turn vs random name turn', () => {
    stubCanvasAndRanges()

    const bigName = makeTextBox('name', 'Kier', { x: 80, y: 60, w: 400, h: 130 }, { fontSize: '120px' })
    const smallName = makeTextBox('name', 'Kier', { x: 80, y: 60, w: 260, h: 72 }, { fontSize: '64px' })
    const titleBox = makeTextBox('title', 'Flow', { x: 80, y: 60, w: 260, h: 72 }, { key: 'capturing-flow', fontSize: '64px' })

    const bigA = paintedName({
      width: 1100,
      height: 600,
      shell: makeShell(1100, 600),
      boxes: () => [bigName],
      random: seeded(12),
    })
    const bigB = paintedName({
      width: 1100,
      height: 600,
      shell: makeShell(1100, 600),
      boxes: () => [bigName],
      random: seeded(77),
    })

    expectValidWashes(bigA.washes)
    expect(bigA.mask).toBeDefined()
    expect(bigA.mask!.height).toBeGreaterThan(0)
    expect(bigA.mask!.field.some((v) => v > 0)).toBe(true)

    const bigLettersA = bigA.washes.filter((w) => w.kind === Kind.Letter)
    const bigLettersB = bigB.washes.filter((w) => w.kind === Kind.Letter)
    expect(bigLettersA).toHaveLength(4)
    expect(bigLettersA.every((w) => w.density === 1.02)).toBe(true)
    expect(bigLettersA.map((w) => w.index)).toEqual([0, 1, 2, 3])
    expect(bigLettersA.map((w) => w.delay)).toEqual([0, 95, 190, 285])
    expect(bigLettersA.map((w) => w.ink)).not.toEqual(bigLettersB.map((w) => w.ink))

    const smallResult = paintedName({
      width: 1100,
      height: 600,
      shell: makeShell(1100, 600),
      boxes: () => [smallName],
      random: seeded(12),
    })
    const smallLetters = smallResult.washes.filter((w) => w.kind === Kind.Letter)
    expect(smallLetters).toHaveLength(4)
    expect(smallLetters.every((w) => w.density === 1.35)).toBe(true)
    expect(smallResult.washes.some((w) => w.kind === Kind.Run)).toBe(false)

    const titleSeed1 = paintedName({
      width: 1100,
      height: 600,
      shell: makeShell(1100, 600),
      boxes: () => [titleBox, bigName],
      random: seeded(12),
    })
    const titleSeed2 = paintedName({
      width: 1100,
      height: 600,
      shell: makeShell(1100, 600),
      boxes: () => [titleBox, bigName],
      random: seeded(99),
    })
    const titleLetters1 = titleSeed1.washes.filter((w) => w.kind === Kind.Letter)
    const titleLetters2 = titleSeed2.washes.filter((w) => w.kind === Kind.Letter)
    expect(titleLetters1).toHaveLength(4)
    expect(titleLetters1.every((w) => w.density === 1.35)).toBe(true)
    expect(titleLetters1.map((w) => [w.ink, w.ink2])).toEqual(titleLetters2.map((w) => [w.ink, w.ink2]))
    expect(titleSeed1.washes.some((w) => w.kind === Kind.Run)).toBe(false)
    expect(titleSeed1.washes.some((w) => w.kind === Kind.Puddle)).toBe(false)
  })

  it('emits runsOf Kind.Run washes below large name feet while clipping or suppressing against blocked boxes and skipping top lines', () => {
    stubCanvasAndRanges()

    const nameEl = document.createElement('h1')
    nameEl.style.fontSize = '120px'
    nameEl.style.fontFamily = 'Newsreader'
    const topLine = document.createElement('span')
    topLine.textContent = 'Ki'
    topLine.style.fontSize = '120px'
    setRect(topLine, { x: 80, y: 60, w: 200, h: 120 })
    const bottomLine = document.createElement('span')
    bottomLine.textContent = 'Kieran'
    bottomLine.style.fontSize = '120px'
    setRect(bottomLine, { x: 80, y: 200, w: 500, h: 120 })
    nameEl.append(topLine, bottomLine)
    const nameBox = makeBox('name', { x: 80, y: 60, w: 500, h: 260 }, 'name', nameEl)

    const unblocked = paintedName({
      width: 1200,
      height: 800,
      shell: makeShell(1200, 800),
      boxes: () => [nameBox],
      random: seeded(5),
    })
    const unblockedRuns = unblocked.washes.filter((w) => w.kind === Kind.Run)
    expect(unblockedRuns.length).toBeGreaterThan(0)
    expect(unblockedRuns.every((w) => w.density === 0.62 && w.still === true && w.lasts === 3200)).toBe(true)
    expect(unblockedRuns.every((w) => w.y > 240)).toBe(true)

    const blocker = makeBox('intro', { x: 60, y: 340, w: 600, h: 60 }, 'intro')
    const clipped = paintedName({
      width: 1200,
      height: 800,
      shell: makeShell(1200, 800),
      boxes: () => [nameBox, blocker],
      random: seeded(5),
    })
    const clippedRuns = clipped.washes.filter((w) => w.kind === Kind.Run)
    expect(clippedRuns.length).toBeGreaterThan(0)
    for (const run of clippedRuns) {
      expect(run.y + run.h).toBeLessThanOrEqual(blocker.y - 12)
    }

    const tightBlocker = makeBox('heading', { x: 60, y: 300, w: 600, h: 60 }, 'heading')
    const suppressed = paintedName({
      width: 1200,
      height: 800,
      shell: makeShell(1200, 800),
      boxes: () => [nameBox, tightBlocker],
      random: seeded(5),
    })
    expect(suppressed.washes.filter((w) => w.kind === Kind.Run)).toHaveLength(0)

    const narrow = paintedName({
      width: 700,
      height: 800,
      shell: makeShell(700, 800),
      boxes: () => [nameBox],
      random: seeded(5),
    })
    const narrowRuns = narrow.washes.filter((w) => w.kind === Kind.Run)
    expect(narrowRuns.length).toBeGreaterThan(0)
    expect(narrowRuns.every((w) => w.h <= 26 + 110)).toBe(true)
  })

  it('emits brush-drop Kind.Puddle washes that avoid blocked boxes and letter feet', () => {
    stubCanvasAndRanges()

    const nameBox = makeTextBox('name', 'Kieran', { x: 80, y: 60, w: 500, h: 130 }, { fontSize: '120px' })
    const blockedBoxes = [
      makeBox('intro', { x: 80, y: 210, w: 220, h: 40 }, 'intro'),
      makeBox('nav', { x: 420, y: 40, w: 180, h: 30 }, 'nav'),
    ]

    const wide = paintedName({
      width: 1200,
      height: 600,
      shell: makeShell(1200, 600),
      boxes: () => [nameBox, ...blockedBoxes],
      random: seeded(19),
    })
    const widePuddles = wide.washes.filter((w) => w.kind === Kind.Puddle)
    expect(widePuddles.length).toBeGreaterThan(0)
    expect(widePuddles.length).toBeLessThanOrEqual(18)
    for (const puddle of widePuddles) {
      expect(puddle.still).toBe(true)
      expect(puddle.density).toBe(0.8)
      expect(puddle.extra).toEqual([2, 0.9, 0, 0])
      for (const box of blockedBoxes) {
        expect(meets(grown(puddle, 6), box)).toBe(false)
      }
      for (let i = 0; i < 6; i++) {
        expect(meets(puddle, { x: 80 + i * 78, y: 60, w: 52, h: 65 })).toBe(false)
      }
    }

    const narrow = paintedName({
      width: 700,
      height: 600,
      shell: makeShell(700, 600),
      boxes: () => [nameBox],
      random: seeded(19),
    })
    const narrowPuddles = narrow.washes.filter((w) => w.kind === Kind.Puddle)
    expect(narrowPuddles.length).toBeGreaterThan(0)
    expect(narrowPuddles.length).toBeLessThanOrEqual(8)

    const fullBlocker = makeBox('staff', { x: 0, y: 0, w: 1200, h: 400 }, 'staff')
    const blockedAll = paintedName({
      width: 1200,
      height: 600,
      shell: makeShell(1200, 600),
      boxes: () => [nameBox, fullBlocker],
      random: seeded(19),
    })
    expect(blockedAll.washes.filter((w) => w.kind === Kind.Puddle)).toHaveLength(0)
  })

  it('connects name feet through swatches with Kind.Run washes when !long and omits the chain when long is true', () => {
    stubCanvasAndRanges()

    const smallNameBox = makeTextBox('name', 'Kieran', { x: 80, y: 60, w: 360, h: 80 }, { fontSize: '80px' })
    const swatches = [
      makeBox('swatch', { x: 96, y: 200, w: 20, h: 20 }, 'capturing-flow'),
      makeBox('swatch', { x: 96, y: 260, w: 20, h: 20 }, 'tool-tailor'),
      makeBox('swatch', { x: 96, y: 320, w: 20, h: 20 }, 'enthusiasm'),
    ]

    const short = paintedName({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [smallNameBox, ...swatches],
      random: seeded(43),
    })
    expectValidWashes(short.washes)
    const chainRuns = short.washes.filter((w) => w.kind === Kind.Run)
    expect(chainRuns).toHaveLength(swatches.length)
    for (const run of chainRuns) {
      expect(run.density).toBe(0.72)
      expect(run.delay).toBe(900)
      expect(run.lasts).toBe(1800)
      expect(run.still).toBe(true)
    }
    expect(chainRuns[0].y).toBeLessThan(swatches[0].y)
    expect(chainRuns[0].y + chainRuns[0].h).toBeCloseTo(swatches[0].y + swatches[0].h * 0.5, 5)
    expect(chainRuns[1].y).toBe(swatches[0].y + swatches[0].h - 5)
    expect(chainRuns[1].y + chainRuns[1].h).toBeCloseTo(swatches[1].y + swatches[1].h * 0.5, 5)
    expect(chainRuns[2].y).toBe(swatches[1].y + swatches[1].h - 5)
    expect(chainRuns[2].y + chainRuns[2].h).toBeCloseTo(swatches[2].y + swatches[2].h * 0.5, 5)

    const offsetSwatches = [
      makeBox('swatch', { x: 650, y: 200, w: 20, h: 20 }, 'capturing-flow'),
      makeBox('swatch', { x: 650, y: 260, w: 20, h: 20 }, 'tool-tailor'),
    ]
    const offsetShort = paintedName({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [smallNameBox, ...offsetSwatches],
      random: seeded(43),
    })
    expect(offsetShort.washes.filter((w) => w.kind === Kind.Run)).toHaveLength(1)

    const longResult = paintedName({
      width: 1000,
      height: 600,
      shell: makeShell(1000, 600),
      boxes: () => [smallNameBox, ...swatches],
      random: seeded(43),
      long: true,
    })
    expect(longResult.washes.filter((w) => w.kind === Kind.Run)).toHaveLength(0)
    expect(longResult.washes.filter((w) => w.kind === Kind.Square)).toHaveLength(0)
  })
})
