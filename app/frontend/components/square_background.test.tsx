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
import PostShow from '../pages/posts/show'
import type { Post } from '../types/page'
import applicationCss from '../entrypoints/application.css?raw'
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
  html: '<p>Body</p>',
}

describe('interactive square background', () => {
  let container: HTMLDivElement
  let root: Root
  let fillRect: ReturnType<typeof vi.fn>
  let resizeDisconnect: ReturnType<typeof vi.fn>
  let resizeObserve: ReturnType<typeof vi.fn>

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    resizeDisconnect = vi.fn()
    resizeObserve = vi.fn()
    fillRect = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    const gradient = { addColorStop: vi.fn() }
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
    class ResizeObserverMock {
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

  it('resizes with persistent layout content changes', () => {
    act(() => root.render(<SiteShell>Page</SiteShell>))

    expect(resizeObserve).toHaveBeenCalledWith(container.querySelector('.site-shell'))
  })
})

describe('Inertia page layout', () => {
  it('keeps the site shell outside page components so Inertia can persist it', () => {
    const pages: ReactElement[] = [
      Home({ posts: [] }),
      About(),
      PostsIndex({ posts: [] }),
      NotFound({ requestedPath: '/missing' }),
      PostShow({ post: POST }),
    ]

    for (const page of pages) expect(page.type).not.toBe(SiteShell)
  })
})
