// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cut, Cutter } from './mask'
import { lettersOf } from './letters'

function makeRect(left: number, top: number, width = 10, height = 20): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

describe('lettersOf', () => {
  let originalRangeRect: PropertyDescriptor | undefined
  let host: HTMLDivElement

  beforeEach(() => {
    originalRangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
    host = document.createElement('div')
    document.body.append(host)
  })

  afterEach(() => {
    host.remove()
    if (originalRangeRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalRangeRect)
    else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
    vi.restoreAllMocks()
  })

  const stubRangeRects = (rectFor: (char: string) => DOMRect) => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value(this: Range) {
        return rectFor(this.toString())
      },
    })
  }

  const stubMeasureContext = (widths: Record<string, number>, ascent: number) => {
    const context = {
      font: '',
      measureText: vi.fn((text: string) => ({
        width: widths[text] ?? 12,
        fontBoundingBoxAscent: ascent,
      })),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    return context
  }

  it('returns undefined when the element is empty or contains only whitespace', () => {
    const cut = vi.fn()
    const cutter = { cut } as unknown as Cutter

    expect(lettersOf(host, 0, 0, cutter)).toBeUndefined()

    host.innerHTML = '   <span>\n\t </span>  '
    expect(lettersOf(host, 0, 0, cutter)).toBeUndefined()
    expect(cut).not.toHaveBeenCalled()
  })

  it('returns undefined without cutting when a 2D canvas context is unavailable', () => {
    host.textContent = 'Hi'
    stubRangeRects(() => makeRect(20, 30))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const cut = vi.fn()

    expect(lettersOf(host, 0, 0, { cut } as unknown as Cutter)).toBeUndefined()
    expect(cut).not.toHaveBeenCalled()
  })

  it('skips whitespace across text nodes and passes expected cutter arguments, draw calls, and coordinates', () => {
    host.innerHTML = ' <span>A </span>\n\t<strong>B</strong> '
    host.style.fontStyle = 'italic'
    host.style.fontWeight = '600'
    host.style.fontSize = '40px'
    host.style.fontFamily = 'Newsreader'

    const rects: Record<string, DOMRect> = {
      A: makeRect(130, 90),
      B: makeRect(165, 92),
    }
    stubRangeRects((char) => rects[char])
    const measureContext = stubMeasureContext({ A: 24, B: 20 }, 32)

    const drawCalls: Array<{ font: string; textBaseline: string; args: unknown[] }> = []
    const cuts: Record<string, Cut> = {
      A: { w: 56, h: 88, uv: [0, 0, 0.1, 0.2], alpha: new Uint8ClampedArray(56 * 88) },
      B: { w: 52, h: 88, uv: [0.2, 0, 0.1, 0.2], alpha: new Uint8ClampedArray(52 * 88) },
    }
    const cut = vi.fn((_w: number, _h: number, _scale: number, _field: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const fillText = vi.fn()
      const drawContext = { font: '', textBaseline: '', fillText }
      draw(drawContext as unknown as CanvasRenderingContext2D)
      const [char] = fillText.mock.calls[0]
      drawCalls.push({ font: drawContext.font, textBaseline: drawContext.textBaseline, args: fillText.mock.calls[0] })
      return cuts[char as string]
    })

    const result = lettersOf(host, 100, 50, { cut } as unknown as Cutter)

    expect(result).toBeDefined()
    expect(result?.field).toBeCloseTo(40 * 0.09)
    expect(measureContext.font).toBe('italic 600 40px Newsreader')
    expect(measureContext.measureText).toHaveBeenCalledWith('Hg')

    expect(cut).toHaveBeenCalledTimes(2)
    expect(cut).toHaveBeenNthCalledWith(1, 24 + 40 * 0.12 + 28, 40 * 1.5 + 28, 1, 40 * 0.09, expect.any(Function))
    expect(cut).toHaveBeenNthCalledWith(2, 20 + 40 * 0.12 + 28, 40 * 1.5 + 28, 1, 40 * 0.09, expect.any(Function))

    expect(drawCalls).toEqual([
      { font: 'italic 600 40px Newsreader', textBaseline: 'alphabetic', args: ['A', 14, 14 + 40 * 1.1] },
      { font: 'italic 600 40px Newsreader', textBaseline: 'alphabetic', args: ['B', 14, 14 + 40 * 1.1] },
    ])

    expect(result?.letters).toEqual([
      {
        char: 'A',
        x: 130 - 100 - 14,
        y: 90 - 50 + 32 - 40 * 1.1 - 14,
        w: 56,
        h: 88,
        uv: [0, 0, 0.1, 0.2],
        feet: [],
      },
      {
        char: 'B',
        x: 165 - 100 - 14,
        y: 92 - 50 + 32 - 40 * 1.1 - 14,
        w: 52,
        h: 88,
        uv: [0.2, 0, 0.1, 0.2],
        feet: [],
      },
    ])
  })

  it.each([
    { fontSize: 69, expectedScale: 1 },
    { fontSize: 70, expectedScale: 0.5 },
    { fontSize: 120, expectedScale: 0.5 },
  ])('uses scale $expectedScale when fontSize is $fontSize px', ({ fontSize, expectedScale }) => {
    host.textContent = 'K'
    host.style.fontSize = `${fontSize}px`
    stubRangeRects(() => makeRect(40, 60))
    stubMeasureContext({ K: 30 }, 50)

    const cut = vi.fn((): Cut => ({
      w: 30,
      h: 44,
      uv: [0, 0, 0.5, 0.5],
      alpha: new Uint8ClampedArray(30 * 44),
    }))

    const result = lettersOf(host, 10, 20, { cut } as unknown as Cutter)

    expect(cut).toHaveBeenCalledWith(
      30 + fontSize * 0.12 + 28,
      fontSize * 1.5 + 28,
      expectedScale,
      fontSize * 0.09,
      expect.any(Function),
    )
    expect(result?.letters[0].w).toBe(30 / expectedScale)
    expect(result?.letters[0].h).toBe(44 / expectedScale)
  })

  it.each([
    { fontSize: 40, scale: 1 },
    { fontSize: 80, scale: 0.5 },
  ])('records the lowest alpha > 127 pixel per column in feet at scale $scale', ({ fontSize, scale }) => {
    host.textContent = 'M'
    host.style.fontSize = `${fontSize}px`
    stubRangeRects(() => makeRect(100, 120))
    stubMeasureContext({ M: 16 }, 30)

    const w = 4
    const h = 5
    const alpha = new Uint8ClampedArray(w * h)
    alpha[4 * w + 0] = 127
    alpha[1 * w + 1] = 200
    alpha[3 * w + 1] = 128
    alpha[4 * w + 1] = 127
    alpha[0 * w + 2] = 255
    alpha[4 * w + 3] = 128

    const cut = vi.fn((): Cut => ({ w, h, uv: [0, 0, 1, 1], alpha }))
    const result = lettersOf(host, 20, 10, { cut } as unknown as Cutter)
    const letter = result!.letters[0]

    expect(letter.feet).toEqual([
      { x: letter.x + 1 / scale, y: letter.y + 3 / scale },
      { x: letter.x + 2 / scale, y: letter.y + 0 / scale },
      { x: letter.x + 3 / scale, y: letter.y + 4 / scale },
    ])
  })
})
