// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PenPicture } from './pen_pictures'
import { PEN_NAMES, PENS, type Tool } from './pens'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const ALL_TOOLS: Tool[] = [...PEN_NAMES, 'eraser']

describe('PenPicture', () => {
  let container: HTMLDivElement
  let root: Root

  function renderTool(tool: Tool, colour: string) {
    act(() => root.render(<PenPicture tool={tool} colour={colour} />))
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    return {
      svg: svg!,
      paths: Array.from(svg!.querySelectorAll('path')),
    }
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it.each(ALL_TOOLS)('renders %s as a decorative SVG with paths and aria-hidden="true"', (tool) => {
    const colour = tool === 'eraser' ? '' : PENS[tool].colours[0][1]
    const { svg, paths } = renderTool(tool, colour)

    expect(svg.getAttribute('viewBox')).toBe('0 0 30 96')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(path.getAttribute('d')).toMatch(/^M/)
    }
  })

  it('renders distinct silhouettes for all six tools', () => {
    const geometries = new Set(
      ALL_TOOLS.map((tool) => {
        const { paths } = renderTool(tool, '#2c5f96')
        return paths.map((path) => path.getAttribute('d')).join('|')
      }),
    )

    expect(geometries.size).toBe(ALL_TOOLS.length)
  })

  it.each([
    { tool: 'pencil' as const, fillCount: 1, strokeCount: 0 },
    { tool: 'liner' as const, fillCount: 1, strokeCount: 1 },
    { tool: 'marker' as const, fillCount: 2, strokeCount: 0 },
    { tool: 'brush' as const, fillCount: 1, strokeCount: 0 },
    { tool: 'highlighter' as const, fillCount: 2, strokeCount: 0 },
  ])('applies the chosen ink colour to $tool paths', ({ tool, fillCount, strokeCount }) => {
    const ink = '#b4473a'
    const { paths } = renderTool(tool, ink)

    expect(paths.filter((path) => path.getAttribute('fill') === ink)).toHaveLength(fillCount)
    expect(paths.filter((path) => path.getAttribute('stroke') === ink)).toHaveLength(strokeCount)

    const nextInk = '#2c5f96'
    const updated = renderTool(tool, nextInk)
    expect(updated.paths.filter((path) => path.getAttribute('fill') === nextInk)).toHaveLength(fillCount)
    expect(updated.paths.filter((path) => path.getAttribute('stroke') === nextInk)).toHaveLength(strokeCount)
    expect(updated.paths.some((path) => path.getAttribute('fill') === ink || path.getAttribute('stroke') === ink)).toBe(false)
  })

  it('renders the eraser with its own fixed colours regardless of the colour prop', () => {
    const ignored = '#b4473a'
    const { paths } = renderTool('eraser', ignored)

    expect(paths).toHaveLength(3)
    expect(paths.map((path) => path.getAttribute('fill'))).toEqual(['#e9a6a0', '#2c5f96', '#fbf6ea'])
    expect(paths.some((path) => path.getAttribute('fill') === ignored || path.getAttribute('stroke') === ignored)).toBe(false)
  })
})
