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
  return { name, key, element, ...rect }
}

function setRect(element: HTMLElement, rect: Rect) {
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

afterEach(() => {
  vi.useRealTimers()
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

    // Touching edges and corner do not meet
    expect(meets(a, { x: 30, y: 10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: -10, y: 10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 10, y: 30, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 10, y: -10, w: 20, h: 20 })).toBe(false)
    expect(meets(a, { x: 30, y: 30, w: 20, h: 20 })).toBe(false)

    // Symmetric
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

    // Obstacle on the left leaves the right strip (70x100) as largest
    expect(beside(cell, [{ x: 0, y: 0, w: 30, h: 100 }], 10)).toEqual({ x: 30, y: 0, w: 70, h: 100 })

    // Obstacle near the top-left: right strip is 70x100 (7000) vs bottom strip 100x60 (6000)
    expect(beside(cell, [{ x: 0, y: 0, w: 30, h: 40 }], 10)).toEqual({ x: 30, y: 0, w: 70, h: 100 })

    // Multiple overlapping obstacles carve sequentially without overlapping any taken box
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
    // Remaining right strip is 12x50, smaller than least = 15
    expect(beside(cell, [{ x: 10, y: 10, w: 38, h: 50 }], 15)).toBeUndefined()
    // Exactly at least = 12 succeeds
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
        { x: 10, y: 100, w: 50, h: 20 }, // off the line
      ],
      seeded(1),
    )
    expect(horizontal.map(({ x, w, kind }) => ({ x, w, kind }))).toEqual([
      { x: 0, w: 80, kind: Kind.Pencil },
      { x: 110, w: 90, kind: Kind.Pencil },
      { x: 240, w: 60, kind: Kind.Pencil },
    ])

    // Gaps <= 24px are dropped; vertical orientation splits along y
    const vertical = ruled(
      { x: 40, y: 0, w: 3, h: 140 },
      [
        { x: 20, y: 20, w: 40, h: 30 }, // leaves 20px above (<= 24, dropped)
      ],
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
      // Warmth stays in either the cool end [0, 0.3) or warm end [0.7, 1)
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

    // Clamps below 0 and beyond the end without NaN
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
    // Includes 26px margin on both sides of the 200px block -> half width 126
    expect(halfAtBlock).toBeGreaterThanOrEqual(125)

    // Far from the block, the creek narrows back down
    const [, halfAway] = courseAt(around, 540)
    expect(halfAway).toBeLessThan(20)

    // A block close to the viewport edges (< 70px margin) expands past the page edge to avoid slivers
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
    // Center y = 140 -> offset = +14.0px
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

    // First two washes correspond to card and sheet, with pale density for sheet
    expect(a.washes[0]).toMatchObject({ x: card.x, y: card.y, w: card.w, h: card.h, kind: Kind.Square })
    expect(a.washes[1]).toMatchObject({ x: sheet.x, y: sheet.y, w: sheet.w, h: sheet.h, density: 0.3 })
    expect(a.washes.some((w) => w.kind === Kind.Pencil)).toBe(true)

    // Net squares (after the 2 cards) must stay outside the grown bare region
    const netSquares = a.washes.slice(2).filter((w) => w.kind === Kind.Square)
    expect(netSquares.length).toBeGreaterThan(0)
    for (const sq of netSquares) expect(meets(sq, bare)).toBe(false)

    // Narrow viewport omits pencil rules and restricts net squares to band boxes
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

  it('score and paintedName compose deterministic washes from swatches, staff, phrases, lines, and rules', () => {
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

    // paintedName with line, swatch, rule (and longPage delegating when stream is absent vs present)
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
    // Long mode omits standalone swatch washes
    expect(paintedLong.washes.length).toBe(paintedShort.washes.length - 1)

    // longPage falls back to paintedName without a stream, and adds banks + course with a stream
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
})
