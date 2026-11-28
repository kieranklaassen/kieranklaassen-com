// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  squareBackground: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('./square_background', () => ({
  SquareBackground: () => {
    mocks.squareBackground()
    return <div data-testid="square-background" />
  },
}))

import { SiteShell } from './site_shell'

describe('SiteShell', () => {
  let container: HTMLDivElement
  let root: Root

  const mount = (element: ReactElement) => act(() => root.render(element))

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.squareBackground.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders the hidden SVG noise filter, background, header, and main children in order', () => {
    mount(
      <SiteShell>
        <section data-testid="page-content">Hello shell</section>
      </SiteShell>,
    )

    const shell = container.querySelector('.site-shell')
    expect(shell).not.toBeNull()

    const svg = shell?.querySelector('svg.square-noise-filter')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('0')
    expect(svg?.getAttribute('height')).toBe('0')

    const filter = svg?.querySelector('filter#square-noise')
    expect(filter).not.toBeNull()
    expect(filter?.querySelector('feTurbulence')?.getAttribute('type')).toBe('fractalNoise')
    expect(filter?.querySelector('feTurbulence')?.getAttribute('baseFrequency')).toBe('0.83')
    expect(filter?.querySelector('feTurbulence')?.getAttribute('numOctaves')).toBe('8')
    expect(filter?.querySelector('feTurbulence')?.getAttribute('stitchTiles')).toBe('stitch')
    expect(filter?.querySelector('feColorMatrix')?.getAttribute('type')).toBe('saturate')
    expect(filter?.querySelector('feColorMatrix')?.getAttribute('values')).toBe('0')
    expect(filter?.querySelector('feComponentTransfer feFuncA')?.getAttribute('type')).toBe('table')
    expect(filter?.querySelector('feComponentTransfer feFuncA')?.getAttribute('tableValues')).toBe('0 0 0.6 0')
    expect(filter?.querySelector('feBlend')?.getAttribute('mode')).toBe('soft-light')

    expect(mocks.squareBackground).toHaveBeenCalledTimes(1)
    expect(shell?.querySelector('[data-testid="square-background"]')).not.toBeNull()
    expect(shell?.querySelector('header h1')?.textContent).toBe('Kieran Klaassen')

    const main = shell?.querySelector('main.min-h-screen')
    expect(main?.querySelector('[data-testid="page-content"]')?.textContent).toBe('Hello shell')

    const directChildren = [...(shell?.children ?? [])].map((child) => child.tagName.toLowerCase())
    expect(directChildren).toEqual(['svg', 'div', 'header', 'main'])
  })
})
