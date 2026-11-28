import { describe, expect, it } from 'vitest'
import { hits, inkOf, pressed, type Point } from './ink'
import { PENS } from './pens'

/** How far a path reaches up and down. Every second number of these paths is a y. */
const tall = (d: string) => {
  const ys = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2)
  return Math.max(...ys) - Math.min(...ys)
}

describe('ink', () => {
  it.each(Object.keys(PENS) as (keyof typeof PENS)[])('leaves a dot where the %s only touches', (pen) => {
    const { d } = inkOf(PENS[pen], [[10, 20, 1]])
    expect(d).toMatch(/^M/)
    expect(d.length).toBeGreaterThan(8)
  })

  it('is wider where a brush is pressed harder', () => {
    const line = (pressure: number): Point[] => [0, 10, 20, 30].map((x) => [x, 50, pressed(PENS.brush, { pointerType: 'pen', pressure }, 0.5, 1)])
    expect(tall(inkOf(PENS.brush, line(0.9)).d)).toBeGreaterThan(tall(inkOf(PENS.brush, line(0.2)).d) * 1.5)
  })

  it('is thinner where a brush without pressure moves fast', () => {
    expect(pressed(PENS.brush, { pointerType: 'mouse', pressure: 0.5 }, 3, 1)).toBeLessThan(pressed(PENS.brush, { pointerType: 'mouse', pressure: 0.5 }, 0.1, 1))
  })

  it('keeps an even line even', () => {
    expect(pressed(PENS.liner, { pointerType: 'pen', pressure: 1 }, 0, 1)).toBe(1)
    expect(inkOf(PENS.liner, [[0, 0, 1], [20, 0, 1]]).width).toBe(PENS.liner.width)
  })
})

describe('hits', () => {
  const line: Point[] = [[0, 0, 1], [100, 0, 1]]

  it('finds a stroke that the eraser crosses between points', () => {
    expect(hits(line, 4, [50, -30], [50, 30])).toBe(true)
  })

  it('finds a stroke that the eraser comes within its width of', () => {
    expect(hits(line, 8, [50, 7], [50, 7])).toBe(true)
  })

  it('leaves a stroke that is out of reach', () => {
    expect(hits(line, 8, [50, 12], [60, 40])).toBe(false)
  })

  it('finds a dot', () => {
    expect(hits([[5, 5, 1]], 4, [0, 5], [10, 5])).toBe(true)
  })
})
