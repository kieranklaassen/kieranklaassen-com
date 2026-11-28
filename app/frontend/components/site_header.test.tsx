// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a data-inertia-link="" {...props}>
      {children}
    </a>
  ),
}))

import { SiteHeader } from './site_header'

describe('SiteHeader', () => {
  let container: HTMLDivElement
  let root: Root

  const mount = (element: ReactElement) => act(() => root.render(element))

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders the brand heading link, bio paragraph, and primary navigation links', () => {
    mount(<SiteHeader />)

    const header = container.querySelector('header')
    expect(header).not.toBeNull()

    const homeLink = header?.querySelector<HTMLAnchorElement>('a[href="/"]')
    expect(homeLink?.hasAttribute('data-inertia-link')).toBe(true)
    expect(homeLink?.querySelector('h1')?.textContent).toBe('Kieran Klaassen')

    const bio = header?.querySelector('p')
    expect(bio?.textContent).toContain("I'm Kieran, a creator and engineer, composer and baker.")
    expect(bio?.textContent).toContain('code to croissants.')

    const nav = header?.querySelector('nav[aria-label="Primary"]')
    expect(nav).not.toBeNull()

    const navLinks = [...(nav?.querySelectorAll<HTMLAnchorElement>('a') ?? [])].map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
      inertia: link.hasAttribute('data-inertia-link'),
    }))
    expect(navLinks).toEqual([
      { href: '/posts', text: 'Thoughts', inertia: true },
      { href: '/about', text: 'About', inertia: true },
    ])
  })
})
