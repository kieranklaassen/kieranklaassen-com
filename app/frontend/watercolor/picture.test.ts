// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pigment, Shape } from '../art/pictures'
import { Cutter } from './mask'
import { Kind, type RGB, type Rect } from './painter'
import { DETAIL, WHOLE, fitted, groundOf, laid, plate, runsOff } from './picture'
import { seeded } from './pigments'

function expectValidRgb(rgb: RGB) {
  expect(rgb).toHaveLength(3)
  for (const ch of rgb) {
    expect(Number.isFinite(ch)).toBe(true)
    expect(ch).toBeGreaterThanOrEqual(0)
    expect(ch).toBeLessThanOrEqual(1)
  }
}

/**
 * Minimal 2D canvas + Path2D stub that maps each SVG path string to a sheet-space box
 * (or a default box) and rasterizes alpha into a buffer so boundsOf/laid/plate run cleanly in jsdom.
 */
function stubCanvas(boxesByPath: Map<string, Rect>, fallback?: Rect) {
  const operations: { kind: 'fill' | 'stroke' | 'lift'; d?: string }[] = []

  class FakePath2D {
    readonly d: string
    constructor(d = '') {
      this.d = d
    }
  }
  vi.stubGlobal('Path2D', FakePath2D)

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

    const rasterize = (box: Rect | undefined) => {
      if (!box) return
      ensureBuffer()
      const x0 = Math.max(0, Math.floor(box.x * sx + tx))
      const y0 = Math.max(0, Math.floor(box.y * sy + ty))
      const x1 = Math.min(canvas.width, Math.ceil((box.x + box.w) * sx + tx))
      const y1 = Math.min(canvas.height, Math.ceil((box.y + box.h) * sy + ty))
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) buffer[(y * canvas.width + x) * 4 + 3] = 255
    }

    return {
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
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill(path?: FakePath2D) {
        if (composite === 'destination-out') {
          operations.push({ kind: 'lift' })
          return
        }
        const d = path?.d ?? ''
        operations.push({ kind: 'fill', d })
        rasterize(boxesByPath.get(d) ?? fallback)
      },
      stroke(path?: FakePath2D) {
        const d = path?.d ?? ''
        operations.push({ kind: 'stroke', d })
        rasterize(boxesByPath.get(d) ?? fallback)
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

  return operations
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fitted', () => {
  it('fills an exact-aspect container with no margin', () => {
    expect(fitted({ x: 10, y: 20, w: 320, h: 200 })).toEqual({ x: 10, y: 20, k: 2 })
  })

  it('centers horizontally in a wide container', () => {
    const result = fitted({ x: 20, y: 10, w: 500, h: 100 })
    expect(result).toEqual({ x: 190, y: 10, k: 1 })
    expect(result.x + WHOLE.across * result.k).toBeLessThanOrEqual(520)
  })

  it('centers vertically in a tall container', () => {
    const result = fitted({ x: 15, y: 30, w: 160, h: 300 })
    expect(result).toEqual({ x: 15, y: 130, k: 1 })
    expect(result.y + WHOLE.down * result.k).toBeLessThanOrEqual(330)
  })

  it('supports custom sheet dimensions such as DETAIL', () => {
    expect(fitted({ x: 0, y: 0, w: 200, h: 80 }, DETAIL.across, DETAIL.down)).toEqual({ x: 60, y: 0, k: 2 })
  })
})

describe('groundOf', () => {
  const flatWarm: (u: number, v: number) => Pigment = () => [0.85, 0.9]
  const flatCool: (u: number, v: number) => Pigment = () => [0.85, 0.1]

  it('tiles a rectangle deterministically with valid square washes covering its span', () => {
    const rect: Rect = { x: 40, y: 20, w: 320, h: 200 }
    const a = groundOf(rect, flatWarm, 40, seeded(12), 0)
    const b = groundOf(rect, flatWarm, 40, seeded(12), 0)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(10)

    let totalArea = 0
    for (const wash of a) {
      expect(wash.kind).toBe(Kind.Square)
      expect(wash.w).toBeGreaterThanOrEqual(3)
      expect(wash.h).toBeGreaterThanOrEqual(3)
      expect(wash.density).toBeGreaterThan(0)
      expectValidRgb(wash.ink)
      expectValidRgb(wash.ink2)
      expect(wash.seed).toHaveLength(4)
      expect(wash.delay).toBeGreaterThanOrEqual(60)
      expect(wash.lasts).toBe(900)
      expect(wash.grow).toBe(0)
      totalArea += wash.w * wash.h
    }

    // With loose = 0 and no skip, cells cover most of the rectangle (modulo gaps)
    expect(totalArea).toBeGreaterThan(rect.w * rect.h * 0.7)
    expect(totalArea).toBeLessThanOrEqual(rect.w * rect.h * 1.05)

    // Coverage reaches near all four edges
    expect(Math.min(...a.map((w) => w.x))).toBeLessThan(rect.x + 15)
    expect(Math.max(...a.map((w) => w.x + w.w))).toBeGreaterThan(rect.x + rect.w - 15)
    expect(Math.min(...a.map((w) => w.y))).toBeLessThan(rect.y + 15)
    expect(Math.max(...a.map((w) => w.y + w.h))).toBeGreaterThan(rect.y + rect.h - 15)
  })

  it('drops edge tiles when loose is high and passes clamped (u, v) to ground', () => {
    const rect: Rect = { x: 0, y: 0, w: 320, h: 200 }
    const tight = groundOf(rect, flatWarm, 40, seeded(7), 0)
    const open = groundOf(rect, flatWarm, 40, seeded(7), 1)
    expect(open.length).toBeGreaterThan(0)
    expect(open.length).toBeLessThan(tight.length)

    const coords: [number, number][] = []
    groundOf(
      rect,
      (u, v) => {
        coords.push([u, v])
        return [0.8, 0.5]
      },
      40,
      seeded(7),
      0,
    )
    expect(coords.length).toBeGreaterThan(0)
    for (const [u, v] of coords) {
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }

    // Ground warmth influences the resulting washes
    const warmWashes = groundOf(rect, flatWarm, 50, seeded(3), 0)
    const coolWashes = groundOf(rect, flatCool, 50, seeded(3), 0)
    const meanWarmBias = (ws: typeof warmWashes) => ws.reduce((sum, w) => sum + (w.ink[0] - w.ink[2]), 0) / ws.length
    expect(meanWarmBias(warmWashes)).toBeGreaterThan(meanWarmBias(coolWashes))
  })

  it('honors the skip callback for excluding regions or all cells', () => {
    const rect: Rect = { x: 100, y: 50, w: 200, h: 120 }
    expect(groundOf(rect, flatWarm, 40, seeded(5), 0, () => true)).toEqual([])

    const rightHalf = groundOf(rect, flatWarm, 40, seeded(5), 0, (_cell, u) => u < 0.5)
    expect(rightHalf.length).toBeGreaterThan(0)
    for (const wash of rightHalf) {
      const u = (wash.x + wash.w / 2 - rect.x) / rect.w
      expect(u).toBeGreaterThanOrEqual(0.5)
    }
  })
})

describe('runsOff, laid, and plate', () => {
  it('runsOff detects shapes reaching the right edge of WHOLE or DETAIL sheets', () => {
    const inside: Shape = { d: 'test-inside', ink: [0.3, 0.5] }
    const rightEdge: Shape = { d: 'test-right-edge', ink: [0.3, 0.5] }
    const detailEdge: Shape = { d: 'test-detail-edge', ink: [0.3, 0.5] }
    stubCanvas(
      new Map<string, Rect>([
        ['test-inside', { x: 10, y: 10, w: 60, h: 40 }],
        ['test-right-edge', { x: 120, y: 20, w: 40, h: 30 }],
        ['test-detail-edge', { x: 20, y: 5, w: 20, h: 10 }],
      ]),
    )

    expect(runsOff([])).toBe(false)
    expect(runsOff([inside])).toBe(false)
    expect(runsOff([inside, rightEdge])).toBe(true)
    expect(runsOff([detailEdge], DETAIL)).toBe(true)
    expect(runsOff([detailEdge], WHOLE)).toBe(false)
  })

  it('laid places scaled letter washes, skips empty shapes, and lifts only left-edge fills', () => {
    const leftFill: Shape = { d: 'laid-left-fill', ink: [0.2, 0.9], to: [0.4, 0.8], density: 0.9 }
    const leftBrush: Shape = { d: 'laid-left-brush', brush: 2, ink: [0.2, 0.2] }
    const middleFill: Shape = { d: 'laid-middle-fill', ink: [0.3, 0.4] }
    const emptyShape: Shape = { d: 'laid-empty', ink: [0.5, 0.5] }

    const ops = stubCanvas(
      new Map<string, Rect>([
        ['laid-left-fill', { x: 0, y: 10, w: 40, h: 20 }],
        ['laid-left-brush', { x: 0, y: 40, w: 30, h: 10 }],
        ['laid-middle-fill', { x: 50, y: 20, w: 25, h: 25 }],
      ]),
    )

    const cutter = new Cutter()
    const washes = laid([leftFill, leftBrush, middleFill, emptyShape], WHOLE, 100, 50, 2, cutter, seeded(4), 300, true)

    // emptyShape produces no wash; the 3 drawn shapes do
    expect(washes).toHaveLength(3)
    for (const wash of washes) {
      expect(wash.kind).toBe(Kind.Letter)
      expectValidRgb(wash.ink)
      expectValidRgb(wash.ink2)
      expect(wash.delay).toBeGreaterThanOrEqual(300)
      expect(wash.field).toBeGreaterThanOrEqual(3)
      expect(wash.field).toBeLessThanOrEqual(15)
    }

    // Coordinates match x + box.x * k - pad (pad = 8)
    expect(washes[0].x).toBe(100 + 0 * 2 - 8)
    expect(washes[0].y).toBe(50 + 10 * 2 - 8)
    expect(washes[2].x).toBe(100 + 50 * 2 - 8)
    expect(washes[2].y).toBe(50 + 20 * 2 - 8)

    // Only leftFill (not leftBrush, not middleFill) triggers destination-out lift
    expect(ops.filter((op) => op.kind === 'lift')).toHaveLength(1)
    expect(cutter.sheet()).toBeDefined()
  })

  it('plate composes deterministic ground and figure washes for known and fallback slugs', () => {
    stubCanvas(new Map(), { x: 40, y: 25, w: 60, h: 40 })

    const box: Rect = { x: 10, y: 20, w: 320, h: 200 }
    const first = plate(box, 'capturing-flow', new Cutter(), seeded(19))
    const second = plate(box, 'capturing-flow', new Cutter(), seeded(19))
    expect(first).toEqual(second)
    expect(first.some((w) => w.kind === Kind.Square)).toBe(true)
    expect(first.some((w) => w.kind === Kind.Letter)).toBe(true)

    // Fallback slug generates a picture and produces valid washes too
    const fallback = plate(box, 'unlisted-article-slug', new Cutter(), seeded(19), true)
    expect(fallback.some((w) => w.kind === Kind.Square)).toBe(true)
    expect(fallback.some((w) => w.kind === Kind.Letter)).toBe(true)
  })
})
