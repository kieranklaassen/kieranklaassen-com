// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('@inertiajs/react', () => ({
  Head: ({ title, children }: PropsWithChildren<{ title?: string }>) => (
    <div data-testid="head" data-title={title}>
      {children}
    </div>
  ),
  Link: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a data-inertia-link="" {...props}>
      {children}
    </a>
  ),
}))

import NotFound from './not_found'

describe('NotFound', () => {
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

  it('sets head title and renders the 404 sheet with requested path and home link', () => {
    mount(<NotFound requestedPath="/missing/page?ref=<test>" />)

    const head = container.querySelector('[data-testid="head"]')
    expect(head?.getAttribute('data-title')).toBe('Page not found')

    const section = container.querySelector('section[data-paint="sheet"][data-key="not_found"]')
    expect(section).not.toBeNull()
    expect(section?.classList.contains('glass-panel')).toBe(true)
    expect(section?.classList.contains('wc-sheet-plain')).toBe(true)
    expect(section?.textContent).toContain('404')
    expect(section?.querySelector('h2')?.textContent).toBe('That page wandered off.')
    expect(section?.querySelector('code')?.textContent).toBe('/missing/page?ref=<test>')

    const homeLink = section?.querySelector<HTMLAnchorElement>('a[href="/"]')
    expect(homeLink?.hasAttribute('data-inertia-link')).toBe(true)
    expect(homeLink?.textContent).toBe('Return home')
  })
})
