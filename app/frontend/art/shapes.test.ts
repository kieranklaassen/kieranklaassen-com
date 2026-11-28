import { describe, expect, it } from 'vitest'
import { bow, box, crescent, drop, half, heart, leaf, line, oval, perched, quad, stone, waves, wing } from './shapes'

function pairsOf(path: string): [number, number][] {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const pairs: [number, number][] = []
  for (let i = 0; i < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
  return pairs
}

describe('art shapes', () => {
  it('builds closed ovals with default circular radius or explicit ry', () => {
    expect(oval(10, 20, 5)).toBe('M5 20A5 5 0 1 1 15 20A5 5 0 1 1 5 20Z')
    expect(oval(10, 20, 5, 8)).toBe('M5 20A5 8 0 1 1 15 20A5 8 0 1 1 5 20Z')
  })

  it('builds a half disc and rotates its flat diameter by angle', () => {
    expect(half(10, 20, 5)).toBe('M5 20A5 5 0 0 1 15 20Z')
    expect(half(10, 20, 5, Math.PI / 2)).toBe('M10 15A5 5 0 0 1 10 25Z')
  })

  it('builds closed polygons with quad and axis-aligned rectangles with box', () => {
    expect(quad(0, 0, 10, 0, 5, 8)).toBe('M0 0L10 0L5 8Z')
    expect(box(2, 3, 10, 20)).toBe('M2 3L12 3L12 23L2 23Z')
  })

  it('builds a leaf from its stalk pointing along angle', () => {
    expect(leaf(0, 0, 100, 20, 0)).toBe('M0 0Q42 -20 100 0Q42 20 0 0Z')
    expect(leaf(10, 20, 100, 20, Math.PI / 2)).toBe('M10 20Q30 62 10 120Q-10 62 10 20Z')
  })

  it('builds straight lines for 2 points and smoothed quadratic paths for 3 or more points', () => {
    expect(line(0, 0, 10, 20)).toBe('M0 0L10 20')
    expect(line(0, 0, 10, 20, 30, 0)).toBe('M0 0Q10 20 30 0')
    expect(line(0, 0, 10, 20, 30, 10, 40, 0)).toBe('M0 0Q10 20 20 15Q30 10 40 0')
    expect(line(0, 0, 10, 20, 30, 0).endsWith('Z')).toBe(false)
  })

  it('sets large-arc and sweep flags on bow according to arc span and direction', () => {
    expect(bow(0, 0, 10, 0, Math.PI / 2)).toBe('M10 0A10 10 0 0 1 0 10')
    expect(bow(0, 0, 10, 0, Math.PI)).toBe('M10 0A10 10 0 0 1 -10 0')
    expect(bow(0, 0, 10, 0, (3 * Math.PI) / 2)).toBe('M10 0A10 10 0 1 1 0 -10')
    expect(bow(0, 0, 10, Math.PI / 2, 0)).toBe('M0 10A10 10 0 0 0 10 0')
    expect(bow(0, 0, 10, (3 * Math.PI) / 2, 0)).toBe('M0 -10A10 10 0 1 0 10 0')
  })

  it('draws a scaled and rotated flying wing silhouette', () => {
    const upright = wing(10, 20, 10)
    const rotated = wing(10, 20, 10, Math.PI)

    expect(upright.startsWith('M0 20.5C')).toBe(true)
    expect(upright.endsWith('Z')).toBe(true)

    const uprightPairs = pairsOf(upright)
    const rotatedPairs = pairsOf(rotated)
    expect(rotatedPairs).toHaveLength(uprightPairs.length)
    uprightPairs.forEach(([ux, uy], i) => {
      const [rx, ry] = rotatedPairs[i]
      expect(ux + rx).toBeCloseTo(20, 2)
      expect(uy + ry).toBeCloseTo(40, 2)
    })
  })

  it('mirrors a perched bird horizontally when way is negative while preserving vertical coordinates', () => {
    const right = perched(50, 40, 10, 1)
    const left = perched(50, 40, 10, -1)

    expect(right).toBe(perched(50, 40, 10))
    expect(right.startsWith('M59.2 33.8')).toBe(true)
    expect(left.startsWith('M40.8 33.8')).toBe(true)

    const rightPairs = pairsOf(right)
    const leftPairs = pairsOf(left)
    expect(leftPairs).toHaveLength(rightPairs.length)
    rightPairs.forEach(([rx, ry], i) => {
      const [lx, ly] = leftPairs[i]
      expect(rx + lx).toBeCloseTo(100, 2)
      expect(ly).toBeCloseTo(ry, 2)
    })
  })

  it('draws closed symmetric heart and drop outlines', () => {
    expect(heart(10, 20, 10)).toBe('M10 30C-5 20 0 9 10 16.5C20 9 25 20 10 30Z')
    expect(drop(10, 20, 10)).toBe('M10 5C13 13 20 16 20 22A10 10 0 1 1 0 22C0 16 7 13 10 5Z')
  })

  it('draws a closed crescent with outer and inner arcs that rotates with angle', () => {
    const upright = crescent(0, 0, 10)
    const quarterTurn = crescent(0, 0, 10, Math.PI / 2)

    expect(upright).toBe('M3.5 -9.4A10 10 0 1 0 3.5 9.4A9.8 10.2 0 0 1 3.5 -9.4Z')
    expect(quarterTurn).toBe('M9.4 3.5A10 10 0 1 0 -9.4 3.5A9.8 10.2 0 0 1 9.4 3.5Z')
  })

  it('draws a deterministic 8-segment stone whose shape varies with k', () => {
    const first = stone(50, 60, 20, 12, 1)
    const repeated = stone(50, 60, 20, 12, 1)
    const other = stone(50, 60, 20, 12, 2)

    expect(first).toBe(repeated)
    expect(first).toBe(stone(50, 60, 20, 12))
    expect(other).not.toBe(first)
    expect(first.match(/Q/g)).toHaveLength(8)
    expect(first.endsWith('Z')).toBe(true)
    for (const [px, py] of pairsOf(first)) {
      expect(px).toBeGreaterThanOrEqual(50 - 22.01)
      expect(px).toBeLessThanOrEqual(50 + 22.01)
      expect(py).toBeGreaterThanOrEqual(60 - 13.21)
      expect(py).toBeLessThanOrEqual(60 + 13.21)
    }
  })

  it('draws waves with the requested crest count and closed rectangular foot', () => {
    const path = waves(10, 20, 80, 30, 4, 5)

    expect(path.startsWith('M10 20')).toBe(true)
    expect(path.match(/q5 -5 10 0q5 5 10 0/g)).toHaveLength(4)
    expect(path.endsWith('L90 50L10 50Z')).toBe(true)
  })
})
