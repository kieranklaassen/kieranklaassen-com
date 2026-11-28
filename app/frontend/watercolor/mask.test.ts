// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cutter, type Cut, type Mask } from './mask'

interface FakeContext {
  globalAlpha: number
  setTransform: ReturnType<typeof vi.fn>
  clearRect: ReturnType<typeof vi.fn>
  fillRect: (x: number, y: number, w: number, h: number) => void
  getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray }
}

function installFake2dContext() {
  const canvases = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>()

  const ensureBuffer = (canvas: HTMLCanvasElement) => {
    const needed = canvas.width * canvas.height
    let buffer = canvases.get(canvas)
    if (!buffer || buffer.length !== needed) {
      buffer = new Uint8ClampedArray(needed)
      canvases.set(canvas, buffer)
    }
    return buffer
  }

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    kind: string,
  ) {
    if (kind !== '2d') return null
    let sx = 1
    let sy = 1

    const ctx: FakeContext = {
      globalAlpha: 1,
      setTransform: vi.fn((a: number, _b: number, _c: number, d: number) => {
        sx = a
        sy = d
      }),
      clearRect: vi.fn((x: number, y: number, w: number, h: number) => {
        const buffer = ensureBuffer(this)
        const stride = this.width
        for (let row = Math.max(0, y); row < Math.min(this.height, y + h); row++) {
          buffer.fill(0, row * stride + Math.max(0, x), row * stride + Math.min(stride, x + w))
        }
      }),
      fillRect: (x: number, y: number, w: number, h: number) => {
        const buffer = ensureBuffer(this)
        const stride = this.width
        const value = Math.round(Math.min(1, Math.max(0, ctx.globalAlpha)) * 255)
        const x0 = Math.max(0, Math.floor(x * sx))
        const y0 = Math.max(0, Math.floor(y * sy))
        const x1 = Math.min(this.width, Math.ceil((x + w) * sx))
        const y1 = Math.min(this.height, Math.ceil((y + h) * sy))
        for (let row = y0; row < y1; row++) {
          for (let col = x0; col < x1; col++) {
            buffer[row * stride + col] = value
          }
        }
      },
      getImageData: (x: number, y: number, w: number, h: number) => {
        const buffer = ensureBuffer(this)
        const stride = this.width
        const data = new Uint8ClampedArray(w * h * 4)
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            data[(row * w + col) * 4 + 3] = buffer[(y + row) * stride + (x + col)]
          }
        }
        return { data }
      },
    }

    return ctx as unknown as CanvasRenderingContext2D
  } as HTMLCanvasElement['getContext'])
}

function readCutFromSheet(mask: Mask, cut: Cut): Uint8Array {
  const originX = Math.round(cut.uv[0] * mask.width)
  const originY = Math.round(cut.uv[1] * mask.height)
  const width = Math.round(cut.uv[2] * mask.width)
  const height = Math.round(cut.uv[3] * mask.height)
  expect(width).toBe(cut.w)
  expect(height).toBe(cut.h)

  const pixels = new Uint8Array(cut.w * cut.h)
  for (let row = 0; row < cut.h; row++) {
    const start = (originY + row) * mask.width + originX
    pixels.set(mask.field.subarray(start, start + cut.w), row * cut.w)
  }
  return pixels
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Cutter', () => {
  it('returns undefined when no cuts have been added', () => {
    installFake2dContext()
    expect(new Cutter().sheet()).toBeUndefined()
  })

  it('produces zeroed cuts without throwing when 2D canvas context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const cutter = new Cutter()
    const cut = cutter.cut(8, 6, 1, 4, () => {
      throw new Error('should not be called without context')
    })

    expect(cut.w).toBe(8)
    expect(cut.h).toBe(6)
    expect(cut.alpha.every((a) => a === 0)).toBe(true)

    const mask = cutter.sheet()!
    expect(mask.width).toBe(2048)
    expect(mask.height).toBe(6)
    expect(readCutFromSheet(mask, cut).every((v) => v === 0)).toBe(true)
  })

  it('computes a signed distance field with inside > 128, boundary ~128, outside < 128, and clamping across reach', () => {
    installFake2dContext()
    const cutter = new Cutter()
    const reach = 3
    const cut = cutter.cut(21, 21, 1, reach, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(6, 6, 9, 9)
      ctx.globalAlpha = 128 / 255
      ctx.fillRect(5, 10, 1, 1)
    })

    const mask = cutter.sheet()!
    const field = readCutFromSheet(mask, cut)
    const at = (x: number, y: number) => field[y * cut.w + x]

    expect(cut.alpha[10 * cut.w + 10]).toBe(255)
    expect(cut.alpha[10 * cut.w + 5]).toBe(128)
    expect(cut.alpha[10 * cut.w + 0]).toBe(0)

    expect(at(10, 10)).toBe(255)
    expect(at(7, 10)).toBeGreaterThan(128)
    expect(at(7, 10)).toBeLessThan(255)
    expect(at(5, 10)).toBeGreaterThanOrEqual(127)
    expect(at(5, 10)).toBeLessThanOrEqual(129)
    expect(at(4, 10)).toBeLessThan(128)
    expect(at(4, 10)).toBeGreaterThan(0)
    expect(at(0, 10)).toBe(0)

    expect(at(10, 10)).toBeGreaterThan(at(7, 10))
    expect(at(7, 10)).toBeGreaterThan(at(6, 10))
    expect(at(6, 10)).toBeGreaterThan(at(5, 10))
    expect(at(5, 10)).toBeGreaterThan(at(4, 10))
    expect(at(4, 10)).toBeGreaterThan(at(0, 10))
  })

  it('scales distances back into page pixels and clamps dimensions to valid sheet bounds', () => {
    installFake2dContext()
    const cutter1x = new Cutter()
    const cut1x = cutter1x.cut(12, 12, 1, 4, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(4, 4, 4, 4)
    })
    const field1x = readCutFromSheet(cutter1x.sheet()!, cut1x)

    const cutter2x = new Cutter()
    const cut2x = cutter2x.cut(12, 12, 2, 4, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(4, 4, 4, 4)
    })
    const field2x = readCutFromSheet(cutter2x.sheet()!, cut2x)

    expect(cut2x.w).toBe(24)
    expect(cut2x.h).toBe(24)
    expect(field2x[12 * cut2x.w + 12]).toBe(field1x[6 * cut1x.w + 6])
    expect(field2x[12 * cut2x.w + 4]).toBe(field1x[6 * cut1x.w + 2])

    const clamped = cutter1x.cut(3000, 0.2, 1, 4, () => {})
    expect(clamped.w).toBe(2048)
    expect(clamped.h).toBe(1)
  })

  it('packs multiple cuts into one sheet, wraps rows past sheet width, and writes normalized UVs pointing to each cut', () => {
    installFake2dContext()
    const cutter = new Cutter()

    const wrapsToSecondRow = cutter.cut(900, 10, 1, 4, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(0, 0, 900, 10)
    })
    const tallest = cutter.cut(1100, 24, 1, 4, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(100, 2, 900, 20)
    })
    const besideTallest = cutter.cut(600, 16, 1, 4, (ctx) => {
      ctx.globalAlpha = 1
      ctx.fillRect(50, 4, 500, 8)
    })

    const uvRef = wrapsToSecondRow.uv
    const mask = cutter.sheet()!

    expect(mask.width).toBe(2048)
    expect(mask.height).toBe(24 + 1 + 10)
    expect(wrapsToSecondRow.uv).toBe(uvRef)

    for (const cut of [wrapsToSecondRow, tallest, besideTallest]) {
      const [u0, v0, uw, vh] = cut.uv
      expect(u0).toBeGreaterThanOrEqual(0)
      expect(v0).toBeGreaterThanOrEqual(0)
      expect(uw).toBeGreaterThan(0)
      expect(vh).toBeGreaterThan(0)
      expect(u0 + uw).toBeLessThanOrEqual(1)
      expect(v0 + vh).toBeLessThanOrEqual(1)
    }

    expect(tallest.uv[0]).toBe(0)
    expect(tallest.uv[1]).toBe(0)
    expect(besideTallest.uv[0]).toBeCloseTo((1100 + 1) / 2048)
    expect(besideTallest.uv[1]).toBe(0)
    expect(wrapsToSecondRow.uv[0]).toBe(0)
    expect(wrapsToSecondRow.uv[1]).toBeCloseTo((24 + 1) / mask.height)

    const wrappedPixels = readCutFromSheet(mask, wrapsToSecondRow)
    expect(wrappedPixels.every((v) => v === 255)).toBe(true)

    const tallestPixels = readCutFromSheet(mask, tallest)
    expect(tallestPixels[12 * tallest.w + 550]).toBe(255)
    expect(tallestPixels[0]).toBe(0)

    const besidePixels = readCutFromSheet(mask, besideTallest)
    expect(besidePixels[8 * besideTallest.w + 300]).toBe(255)
    expect(besidePixels[0]).toBe(0)
  })
})
