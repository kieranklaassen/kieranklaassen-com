// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { anchor, blocksOf, cut, linesOf, place, type Box } from './anchor'
import type { Point, Stroke } from './ink'

const CHAR = 10
const LINE = 30

interface Laid {
  x: number
  y: number
  w: number
}

/** Lays every block as text of ten pixels a letter, broken where it reaches the block's width. */
function layOut(laid: Map<Element, Laid>, between = LINE) {
  const heightOf = (one: Element, w: number) => Math.ceil(((one.textContent?.length ?? 0) * CHAR) / w) * LINE
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const at = laid.get(this)
    return at ? new DOMRect(at.x, at.y, at.w, heightOf(this, at.w)) : new DOMRect(0, 0, 1000, 1000)
  })
  Range.prototype.getClientRects = function (this: Range) {
    const block = this.startContainer.parentElement!
    const at = laid.get(block)!
    const each = Math.floor(at.w / CHAR)
    const rects: DOMRect[] = []
    for (let i = this.startOffset; i < this.endOffset; i++) rects.push(new DOMRect(at.x + (i % each) * CHAR, at.y + Math.floor(i / each) * between + 4, CHAR, 22))
    return rects as unknown as DOMRectList
  }
}

function page(html: string) {
  document.body.innerHTML = `<div class="wc"><main>${html}</main></div>`
  return document.querySelector<HTMLElement>('.wc')!
}

const strokeOf = (points: Point[], at: Stroke['at']): Stroke => ({ id: '1', pen: 'liner', colour: '#1f1a1d', points, at })
const reach = (points: Point[]): Box => {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

const WORDS = 'abcdefghijklmnopqrstuvwxyz0123' // thirty letters
const along: Point[] = [[100, 16, 1], [140, 17, 1], [180, 16, 1]]
const round: Point[] = [[100, 0, 1], [140, -8, 1], [180, 30, 1], [140, 60, 1], [100, 0, 1]]

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(Range.prototype, 'getClientRects')
})

describe('a stroke along a line', () => {
  it('is anchored to the words it runs over, and follows them when they break elsewhere', () => {
    const shell = page(`<p>${WORDS}</p>`)
    const p = shell.querySelector('p')!
    const laid = new Map([[p, { x: 0, y: 0, w: 300 }]])
    layOut(laid)
    const { at, points } = anchor(along, shell)
    expect(at.words).toMatchObject({ from: 10, to: 18 })

    laid.set(p, { x: 20, y: 100, w: 140 }) // fourteen letters a line: the words break after the fourth
    const placed = place(strokeOf(points, at), blocksOf(shell), shell)!
    expect(placed).toHaveLength(2)
    expect(reach(placed[0])).toMatchObject({ x: 120, w: 40 })
    expect(reach(placed[1])).toMatchObject({ x: 20, w: 40 })
    expect(placed[0][0][1]).toBeCloseTo(116)
    expect(placed[1].at(-1)![1]).toBeCloseTo(146)
  })

  it('is taken for the line it is under, not the one it is over', () => {
    const shell = page(`<p>${WORDS}${WORDS}</p>`)
    const p = shell.querySelector('p')!
    layOut(new Map([[p, { x: 0, y: 0, w: 300 }]]))
    const under: Point[] = [[100, 28, 1], [180, 29, 1]]
    expect(anchor(under, shell).at.words).toMatchObject({ from: 10, to: 18 })
  })
})

describe('a stroke along a line of a tightly set title', () => {
  it('is taken for the line it goes through, not the one whose letters reach into it', () => {
    const shell = page(`<p>${WORDS}${WORDS}</p>`)
    layOut(new Map([[shell.querySelector('p')!, { x: 0, y: 0, w: 300 }]]), 17)
    const through: Point[] = [[100, 29, 1], [180, 30, 1]] // the first line's letters end at 26, the second's begin at 21
    expect(anchor(through, shell).at.words).toMatchObject({ from: 40, to: 48 })
  })
})

describe('a stroke along words that are no longer there', () => {
  it('stays with its block', () => {
    const shell = page(`<p>${WORDS}${WORDS}</p>`)
    const p = shell.querySelector('p')!
    const laid = new Map([[p, { x: 0, y: 0, w: 600 }]])
    layOut(laid)
    const { at, points } = anchor([[500, 16, 1], [580, 16, 1]], shell)
    expect(at.words).toMatchObject({ from: 50, to: 58 })
    p.textContent = `${WORDS}${WORDS}`.slice(0, 48)
    const placed = place(strokeOf(points, at), blocksOf(shell), shell)!
    expect(placed).toHaveLength(1)
    expect(reach(placed[0])).toMatchObject({ x: 500, w: 80 })
  })
})

describe('any other stroke', () => {
  it('is anchored to its block and keeps its proportions there', () => {
    const shell = page(`<p>${WORDS}</p>`)
    const p = shell.querySelector('p')!
    const laid = new Map([[p, { x: 0, y: 0, w: 300 }]])
    layOut(laid)
    const { at, points } = anchor(round, shell)
    expect(at.words).toBeUndefined()

    laid.set(p, { x: 0, y: 500, w: 150 })
    const [placed] = place(strokeOf(points, at), blocksOf(shell), shell)!
    const was = reach(round)
    const now = reach(placed)
    expect(now.w / now.h).toBeCloseTo(was.w / was.h)
    expect(now.w).toBeCloseTo(was.w / 2)
    expect(now.x + now.w / 2).toBeCloseTo(70)
  })

  it('is not made larger by a wider block', () => {
    const shell = page(`<p>${WORDS}</p>`)
    const p = shell.querySelector('p')!
    const laid = new Map([[p, { x: 0, y: 0, w: 150 }]])
    layOut(laid)
    const { at, points } = anchor(round.map(([x, y, w]) => [x - 60, y, w]), shell)
    laid.set(p, { x: 0, y: 0, w: 300 })
    expect(reach(place(strokeOf(points, at), blocksOf(shell), shell)![0]).w).toBeCloseTo(80)
  })
})

describe('a block', () => {
  it('is found by its words when it has moved, and not at all when it is gone', () => {
    const shell = page(`<p>${WORDS}</p>`)
    layOut(new Map([[shell.querySelector('p')!, { x: 0, y: 0, w: 300 }]]))
    const { at, points } = anchor(round, shell)

    const later = page(`<p>New</p><p>${WORDS}</p>`)
    const [first, second] = later.querySelectorAll('p')
    layOut(new Map([[first, { x: 0, y: 0, w: 300 }], [second, { x: 0, y: 200, w: 300 }]]))
    expect(reach(place(strokeOf(points, at), blocksOf(later), later)![0]).y).toBeCloseTo(192)

    const gone = page('<p>New</p>')
    expect(place(strokeOf(points, at), blocksOf(gone), gone)).toBeUndefined()
  })

  it('is never one of the controls', () => {
    const shell = page('<p>One</p><div class="wc-pens"><p>Two</p></div>')
    expect(blocksOf(shell).map((one) => one.textContent)).toEqual(['One'])
  })
})

describe('cut', () => {
  it('splits by how wide each line is', () => {
    const points: Point[] = [[0, 5, 1], [100, 5, 1]]
    const cuts = cut(points, { x: 0, y: 0, w: 100, h: 10 }, [{ x: 50, y: 0, w: 75, h: 10 }, { x: 0, y: 20, w: 25, h: 10 }])
    expect(cuts.map((one) => reach(one).w)).toEqual([75, 25])
  })
})

describe('linesOf', () => {
  it('joins the rectangles of one line', () => {
    const rects = [new DOMRect(0, 0, 40, 20), new DOMRect(40, 2, 30, 18), new DOMRect(0, 30, 10, 20)]
    expect(linesOf(rects)).toEqual([{ x: 0, y: 0, w: 70, h: 20 }, { x: 0, y: 30, w: 10, h: 20 }])
  })
})
