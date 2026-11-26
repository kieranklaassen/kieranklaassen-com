// @vitest-environment jsdom

import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import About from '../pages/about'
import Home from '../pages/home'
import NotFound from '../pages/not_found'
import PostsIndex from '../pages/posts/index'
import PostShow, { AiAssistanceDisclosure } from '../pages/posts/show'
import type { Post } from '../types/page'
import applicationCss from '../entrypoints/application.css?raw'
import { PostList } from './post_list'
import { SiteShell } from './site_shell'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const POST: Post = {
  slug: 'test-post',
  title: 'Test post',
  date: '2026-06-25',
  categories: ['testing'],
  description: 'Test post.',
  path: '/testing/2026/06/25/test-post/',
  ai_assisted: true,
  html: '<p>Body</p>',
}

const HALFWAY_MARGIN = 1e-3

// The 8-bit alpha an engine draws for an rgba() string, rounded to nearest. Too close
// to halfway is undefined, because engines may disagree there.
function drawnAlpha(color: string) {
  const exact = Number(color.slice(color.lastIndexOf(',') + 1, -1)) * 255
  const below = Math.floor(exact)
  const fraction = exact - below
  if (Math.abs(fraction - 0.5) < HALFWAY_MARGIN) return undefined
  return fraction > 0.5 ? below + 1 : below
}

// The gradient stop colors of one square on each frame, eased independently.
function easeColors(start: number, target: number, offset: number, frameCount: number) {
  let opacity = start
  return Array.from({ length: frameCount }, () => {
    opacity += (target - opacity) * 0.05
    const end = Math.max(0, opacity - 40 + offset)
    return [opacity, end].map((value) => `rgba(128,128,128,${value / 255})`)
  })
}

function drawnValueChanged(previous: string[] | undefined, colors: string[]) {
  return colors.some((color, stop) => {
    const alpha = drawnAlpha(color)
    return alpha === undefined || !previous || alpha !== drawnAlpha(previous[stop])
  })
}

describe('interactive square background', () => {
  let container: HTMLDivElement
  let root: Root
  let fillRect: ReturnType<typeof vi.fn>
  let addColorStop: ReturnType<typeof vi.fn>
  let resizeDisconnect: ReturnType<typeof vi.fn>
  let resizeObserve: ReturnType<typeof vi.fn>
  let resizeCallback: (() => void) | undefined

  const stubFrames = () => {
    let pending: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending = callback
      return 1
    })
    return {
      isPending: () => pending !== undefined,
      run: (limit: number) => {
        let frames = 0
        while (pending && frames < limit) {
          const callback = pending
          pending = undefined
          callback(0)
          frames += 1
        }
        return frames
      },
    }
  }

  // Values are drawn in threes: the base color, then opacity, target and gradient
  // offset per square. Every square therefore starts away from its target.
  const startSquaresAwayFromTarget = () => {
    const values = [0.25, 0.75, 0.5]
    let call = 0
    vi.mocked(Math.random).mockImplementation(() => values[call++ % values.length])
  }

  const renderSettled = () => {
    const frames = stubFrames()
    startSquaresAwayFromTarget()
    act(() => root.render(<SiteShell>Page</SiteShell>))
    expect(frames.run(2000)).toBeGreaterThan(50)
    expect(frames.isPending()).toBe(false)
    return frames
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    resizeDisconnect = vi.fn()
    resizeObserve = vi.fn()
    fillRect = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    addColorStop = vi.fn()
    const gradient = { addColorStop }
    const context = {
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      fillRect,
      fillStyle: '',
      setTransform: vi.fn(),
    }

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(268)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(268)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 268,
      height: 268,
      left: 0,
      right: 268,
      top: 0,
      width: 268,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false }) as MediaQueryList))
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    resizeCallback = undefined
    class ResizeObserverMock {
      constructor(callback: () => void) {
        resizeCallback = callback
      }
      disconnect = resizeDisconnect
      observe = resizeObserve
      unobserve = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reacts once when the pointer enters each square', () => {
    act(() => root.render(<SiteShell>Page</SiteShell>))
    const initialRandomCalls = vi.mocked(Math.random).mock.calls.length

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }))
    expect(Math.random).toHaveBeenCalledTimes(initialRandomCalls + 1)

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 20 }))
    expect(Math.random).toHaveBeenCalledTimes(initialRandomCalls + 1)

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 150, clientY: 20 }))
    expect(Math.random).toHaveBeenCalledTimes(initialRandomCalls + 2)
  })

  it('stops drawing once every square has settled and resumes on hover', () => {
    const frames = renderSettled()

    vi.mocked(Math.random).mockReturnValue(0)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }))
    expect(frames.run(50)).toBe(50)
    // Target 0: decay must not keep the loop alive until it underflows.
    frames.run(2000)
    expect(frames.isPending()).toBe(false)
  })

  it('keeps easing without repainting once no square rounds to a new opacity', () => {
    const frames = stubFrames()
    startSquaresAwayFromTarget()
    act(() => root.render(<SiteShell>Page</SiteShell>))

    // 47 of the first 51 draws reach a new whole opacity; each paints all 12 squares.
    expect(frames.run(50)).toBe(50)
    expect(fillRect).toHaveBeenCalledTimes(12 * 47)
    frames.run(150)
    fillRect.mockClear()

    expect(frames.run(100)).toBe(100)
    expect(fillRect).not.toHaveBeenCalled()

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }))
    vi.mocked(Math.random).mockReturnValue(0)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 150, clientY: 10 }))
    frames.run(1)
    expect(fillRect).toHaveBeenCalledTimes(12)
  })

  // Gives every square the same start, target and gradient offset, so that one
  // square's changes decide every paint.
  const startSquaresAt = (start: number, target: number, offset: number) => {
    const values = [(start + 0.5) / 256, (target + 0.5) / 256, (offset + 30.5) / 61]
    let call = 0
    vi.mocked(Math.random).mockImplementation(() => {
      call += 1
      return call <= 3 ? 0.5 : values[(call - 4) % 3]
    })
  }

  // Returns the stop colors painted since the last call, checking that a paint
  // covers all 12 squares with the same two colors.
  const takePaint = () => {
    const colors = addColorStop.mock.calls.map(([, color]) => color as string)
    expect(fillRect.mock.calls.length).toBe(colors.length / 2)
    expect([0, 24]).toContain(colors.length)
    addColorStop.mockClear()
    fillRect.mockClear()
    expect(colors).toEqual(Array.from(colors, (_, index) => colors[index % 2]))
    return colors.length ? colors.slice(0, 2) : undefined
  }

  it.each([
    { start: 64, target: 192, offset: 0, near: 0 },
    { start: 200, target: 20, offset: 30, near: 0 },
    { start: 200, target: 201, offset: -30, near: 0 },
    { start: 10, target: 9, offset: 0, near: 0 },
    // Each of these lands just short of, or just past, halfway between two levels.
    { start: 0, target: 17, offset: 0, near: 1 },
    { start: 0, target: 36, offset: 0, near: 1 },
    { start: 2, target: 0, offset: 0, near: 1 },
    { start: 14, target: 0, offset: 0, near: 1 },
  ])(
    'paints exactly when a drawn alpha changes from $start to $target (offset $offset)',
    ({ start, target, offset, near }) => {
      const frames = stubFrames()
      startSquaresAt(start, target, offset)
      const expected = easeColors(start, target, offset, 201)
      act(() => root.render(<SiteShell>Page</SiteShell>))

      const painted = [takePaint()]
      while (painted.length < expected.length && frames.run(1)) painted.push(takePaint())

      expect(painted).toEqual(
        expected.map((colors, frame) =>
          drawnValueChanged(expected[frame - 1], colors) ? colors : undefined,
        ),
      )
      const nearFrames = expected.flatMap((colors, frame) =>
        frame > 0 && colors.some((color) => drawnAlpha(color) === undefined) ? [frame] : [],
      )
      expect(nearFrames.length).toBeGreaterThanOrEqual(near)
      for (const frame of nearFrames) expect(painted[frame]).toBeDefined()
    },
  )

  it.each([
    ['a window resize', () => window.dispatchEvent(new Event('resize'))],
    ['a ResizeObserver callback', () => resizeCallback?.()],
  ])('draws again after %s changes the canvas size, then settles', (_source, triggerResize) => {
    const frames = renderSettled()
    const canvas = container.querySelector('canvas')
    expect(canvas?.width).toBe(268)
    fillRect.mockClear()

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(402)
    triggerResize()
    expect(canvas?.width).toBe(402)

    expect(frames.run(50)).toBe(50)
    // The column that only exists at the new width is drawn.
    expect(fillRect).toHaveBeenCalledWith(268, 0, 134, 134)
    frames.run(2000)
    expect(frames.isPending()).toBe(false)
  })

  it('draws again after the canvas context is restored, then settles', () => {
    const frames = renderSettled()
    fillRect.mockClear()

    container.querySelector('canvas')?.dispatchEvent(new Event('contextrestored'))

    // Nothing is moving, so one frame repaints every square and the loop stops.
    expect(frames.run(2000)).toBe(1)
    expect(fillRect).toHaveBeenCalledTimes(12)
    expect(frames.isPending()).toBe(false)
  })

  it('stops listening for a restored canvas context once unmounted', () => {
    const frames = renderSettled()
    const canvas = container.querySelector('canvas')

    act(() => root.unmount())
    canvas?.dispatchEvent(new Event('contextrestored'))

    expect(canvas).not.toBeNull()
    expect(frames.isPending()).toBe(false)
  })

  it('includes the original noise texture filter', () => {
    const markup = renderToStaticMarkup(<SiteShell>Page</SiteShell>)
    const renderedShell = document.createElement('div')
    renderedShell.innerHTML = markup

    expect(markup).toContain('id="square-noise"')
    expect(markup).toContain('<feTurbulence')
    expect(renderedShell.querySelector<HTMLCanvasElement>('canvas')?.style.filter).toBe(
      'url("#square-noise")',
    )
  })

  it('keeps a static background visible when reduced motion is enabled', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }) as MediaQueryList))

    act(() => root.render(<SiteShell>Page</SiteShell>))

    expect(fillRect).toHaveBeenCalled()
    expect(applicationCss).not.toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.square-background\s*\{[\s\S]*?display:\s*none/,
    )
  })

  it('renders at CSS-pixel resolution so the full-page noise filter stays responsive', () => {
    vi.stubGlobal('devicePixelRatio', 2)

    act(() => root.render(<SiteShell>Page</SiteShell>))

    const canvas = container.querySelector('canvas')
    expect(canvas?.width).toBe(268)
    expect(canvas?.height).toBe(768)
  })

  it('resizes with persistent layout content changes', () => {
    act(() => root.render(<SiteShell>Page</SiteShell>))

    expect(resizeObserve).toHaveBeenCalledWith(container.querySelector('.site-shell'))
  })
})

describe('Inertia page layout', () => {
  it('keeps the site shell outside page components so Inertia can persist it', () => {
    const pages: ReactElement[] = [
      Home({ posts: [], repositories: [] }),
      About(),
      PostsIndex({ posts: [] }),
      NotFound({ requestedPath: '/missing' }),
      PostShow({ post: POST }),
    ]

    for (const page of pages) expect(page.type).not.toBe(SiteShell)
  })

  it('discloses AI assistance on marked articles', () => {
    const markup = renderToStaticMarkup(<AiAssistanceDisclosure visible />)

    expect(markup).toContain('AI-assisted writing. The original ideas and experiences are mine.')
  })

  it('omits the disclosure on unmarked articles', () => {
    expect(renderToStaticMarkup(<AiAssistanceDisclosure visible={false} />)).toBe('')
  })
})

describe('post list', () => {
  it('opens Every publications in a new tab', () => {
    const markup = renderToStaticMarkup(
      <PostList
        posts={[
          {
            ...POST,
            slug: 'every-test-post',
            path: 'https://every.to/source-code/test-post',
            external_url: 'https://every.to/source-code/test-post',
          },
        ]}
      />,
    )

    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
    expect(markup).toContain('Every ↗')
  })
})
