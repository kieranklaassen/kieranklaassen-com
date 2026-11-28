// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { book, river } from '../watercolor/article'
import { longPage, mosaic } from '../watercolor/compose'
import { ARTS, LOOKS, type Art, type Look, type Rooms } from './looks'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  usePage: vi.fn(),
  siteShell: vi.fn(),
  paintedSheet: vi.fn(),
  pens: vi.fn(),
  sound: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  usePage: mocks.usePage,
  Link: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('../components/site_shell', () => ({
  SiteShell: ({ children }: PropsWithChildren) => {
    mocks.siteShell()
    return <div data-testid="site-shell">{children}</div>
  },
}))

vi.mock('../watercolor/sheet', () => ({
  PaintedSheet: (props: { compose: Rooms['compose']; page: string }) => {
    mocks.paintedSheet(props)
    return <div data-testid="painted-sheet" />
  },
}))

vi.mock('../pens/pens_tray', () => ({
  Pens: (props: { path: string }) => {
    mocks.pens(props)
    return <div data-testid="pens" />
  },
}))

vi.mock('./sound', () => ({
  Sound: (props: { rooms: Rooms; url: string }) => {
    mocks.sound(props)
    return <div data-testid="sound" />
  },
}))

import { LookShell } from './shell'

function setPage(page: { look: Look; art?: Art; chooseLook?: boolean; url: string; component: string }) {
  mocks.usePage.mockReturnValue({
    props: {
      look: page.look,
      art: page.art ?? 'wide',
      chooseLook: page.chooseLook ?? false,
    },
    url: page.url,
    component: page.component,
  })
}

describe('LookShell', () => {
  let container: HTMLDivElement
  let root: Root

  const chooserLinks = () =>
    Array.from(container.querySelectorAll<HTMLAnchorElement>('.wc-chooser a')).map((link) => ({
      href: link.getAttribute('href'),
      title: link.textContent,
      current: link.getAttribute('aria-current'),
    }))

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.usePage.mockReset()
    mocks.siteShell.mockReset()
    mocks.paintedSheet.mockReset()
    mocks.pens.mockReset()
    mocks.sound.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders SiteShell without watercolor chrome for the blocks look', () => {
    setPage({ look: 'blocks', url: '/about', component: 'about' })

    act(() => root.render(<LookShell>Page body</LookShell>))

    expect(mocks.siteShell).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid="site-shell"]')?.textContent).toBe('Page body')
    expect(container.querySelector('.wc')).toBeNull()
    expect(mocks.paintedSheet).not.toHaveBeenCalled()
    expect(mocks.pens).not.toHaveBeenCalled()
    expect(mocks.sound).not.toHaveBeenCalled()
    expect(container.querySelector('.wc-chooser')).toBeNull()
  })

  it('renders watercolor layout, PaintedSheet, LookHeader, Pens, and Sound for a non-article look', () => {
    setPage({ look: 'long', url: '/', component: 'home' })

    act(() => root.render(<LookShell>Home body</LookShell>))

    const shell = container.querySelector('.wc')
    expect(shell).not.toBeNull()
    expect(shell?.getAttribute('data-art')).toBeNull()

    expect(mocks.paintedSheet).toHaveBeenCalledWith({ compose: longPage, page: '/' })
    expect(container.querySelector('.wc-head')?.getAttribute('data-look')).toBe('name')

    const header = container.querySelector('.wc-header')
    expect(header?.getAttribute('data-small')).toBeNull()
    const navHrefs = Array.from(header?.querySelectorAll('a') ?? []).map((link) => link.getAttribute('href'))
    expect(navHrefs).toEqual(['/', '/posts', '/about'])

    const main = container.querySelector('main.wc-body')
    expect(main?.getAttribute('data-look')).toBe('long')
    expect(main?.getAttribute('data-page')).toBe('home')
    expect(main?.textContent).toBe('Home body')

    expect(mocks.pens).toHaveBeenCalledWith({ path: '/' })
    expect(mocks.sound).toHaveBeenCalledWith({
      rooms: { head: 'name', body: 'long', compose: longPage },
      url: '/',
    })
    expect(container.querySelector('.wc-chooser')).toBeNull()
  })

  it('sets data-art and compact header (data-small) on posts/show pages', () => {
    setPage({ look: 'rooms', art: 'river', url: '/posts/2026/river', component: 'posts/show' })

    act(() => root.render(<LookShell>Article</LookShell>))

    expect(container.querySelector('.wc')?.getAttribute('data-art')).toBe('river')
    expect(container.querySelector('.wc-head')?.getAttribute('data-look')).toBe('article')
    expect(container.querySelector('.wc-header')?.getAttribute('data-small')).toBe('true')
    expect(container.querySelector('main.wc-body')?.getAttribute('data-look')).toBe('article')
    expect(container.querySelector('main.wc-body')?.getAttribute('data-page')).toBe('posts/show')
    expect(mocks.paintedSheet).toHaveBeenCalledWith({ compose: river, page: '/posts/2026/river' })
    expect(mocks.pens).toHaveBeenCalledWith({ path: '/posts/2026/river' })
    expect(mocks.sound).toHaveBeenCalledWith({
      rooms: { head: 'article', body: 'article', art: 'river', compose: river },
      url: '/posts/2026/river',
    })

    setPage({ look: 'mosaic', url: '/posts/preview', component: 'posts/show_preview' })
    act(() => root.render(<LookShell>Preview</LookShell>))
    expect(container.querySelector('.wc-header')?.getAttribute('data-small')).toBe('true')
    expect(mocks.paintedSheet).toHaveBeenLastCalledWith({ compose: mosaic, page: '/posts/preview' })
    expect(mocks.pens).toHaveBeenLastCalledWith({ path: '/posts/preview' })
  })

  it('renders LookChooser with ARTS (?art=), strips existing query params, and marks active art', () => {
    setPage({
      look: 'long',
      art: 'book',
      chooseLook: true,
      url: '/posts/essay?art=wide&utm=1',
      component: 'posts/show',
    })

    act(() => root.render(<LookShell>Article</LookShell>))

    expect(mocks.paintedSheet).toHaveBeenCalledWith({ compose: book, page: '/posts/essay?art=wide&utm=1' })
    expect(mocks.pens).toHaveBeenCalledWith({ path: '/posts/essay' })
    expect(container.querySelector('.wc-chooser')?.getAttribute('aria-label')).toBe('Look')
    expect(chooserLinks()).toEqual(
      ARTS.map((one) => ({
        href: `/posts/essay?art=${one.art}`,
        title: one.title,
        current: one.art === 'book' ? 'true' : null,
      })),
    )
  })

  it.each([
    { look: 'mosaic' as Look, url: '/about?look=score&x=1', component: 'about', expectedPath: '/about' },
    { look: 'long' as Look, url: '/about#bio', component: 'about', expectedPath: '/about' },
    { look: 'blocks' as Look, url: '/posts?look=long', component: 'posts/index', expectedPath: '/posts' },
  ])(
    'renders LookChooser with LOOKS (?look=) for $look look, stripping query and hash from path and marking active choice',
    ({ look, url, component, expectedPath }) => {
      setPage({ look, chooseLook: true, url, component })

      act(() => root.render(<LookShell>Content</LookShell>))

      expect(container.querySelector('.wc-chooser')?.getAttribute('aria-label')).toBe('Look')
      expect(chooserLinks()).toEqual(
        LOOKS.map((one) => ({
          href: `${expectedPath}?look=${one.look}`,
          title: one.title,
          current: one.look === look ? 'true' : null,
        })),
      )
      if (look === 'blocks') {
        expect(mocks.pens).not.toHaveBeenCalled()
      } else {
        expect(mocks.pens).toHaveBeenCalledWith({ path: expectedPath })
      }
    },
  )
})
