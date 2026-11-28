// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostSummary } from '../types/page'

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

import { PostList } from './post_list'

const INTERNAL_POST: PostSummary = {
  slug: 'local-essay',
  title: 'Local Essay',
  date: '2026-01-01',
  categories: ['Creating'],
  description: 'Published directly on the site.',
  path: '/creating/2026/01/01/local-essay/',
}

const EXTERNAL_POST: PostSummary = {
  slug: 'every-essay',
  title: 'Every Essay',
  date: '2025-12-31',
  categories: ['AI'],
  description: 'Published on Every.',
  path: '/ai/2025/12/31/every-essay/',
  external_url: 'https://every.to/source-code/every-essay',
}

describe('PostList', () => {
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

  it('renders internal posts as Inertia links and external posts as safe new-tab anchors', () => {
    mount(<PostList posts={[INTERNAL_POST, EXTERNAL_POST]} />)

    const links = [...container.querySelectorAll<HTMLAnchorElement>('a')]
    expect(links).toHaveLength(2)

    const [internal, external] = links
    expect(internal.hasAttribute('data-inertia-link')).toBe(true)
    expect(internal.getAttribute('href')).toBe(INTERNAL_POST.path)
    expect(internal.getAttribute('target')).toBeNull()
    expect(internal.getAttribute('rel')).toBeNull()
    expect(internal.querySelector('h3')?.textContent).toBe('Local Essay')
    expect(internal.querySelector('p')?.textContent).toBe('Published directly on the site.')
    expect(internal.textContent).not.toContain('Every ↗')

    expect(external.hasAttribute('data-inertia-link')).toBe(false)
    expect(external.getAttribute('href')).toBe(EXTERNAL_POST.external_url)
    expect(external.getAttribute('target')).toBe('_blank')
    expect(external.getAttribute('rel')).toBe('noopener noreferrer')
    expect(external.querySelector('h3')?.textContent).toBe('Every Essay')
    expect(external.querySelector('p')?.textContent).toBe('Published on Every.')
    expect(external.textContent).toContain('Every ↗')
  })

  it('formats dates in UTC while preserving the ISO dateTime attribute', () => {
    mount(<PostList posts={[INTERNAL_POST, EXTERNAL_POST]} />)

    const times = [...container.querySelectorAll('time')]
    expect(times.map((node) => [node.getAttribute('dateTime'), node.textContent])).toEqual([
      ['2026-01-01', 'Jan 1, 2026'],
      ['2025-12-31', 'Dec 31, 2025'],
    ])
  })

  it('renders an empty grid when given no posts', () => {
    mount(<PostList posts={[]} />)

    const grid = container.querySelector('.grid')
    expect(grid).not.toBeNull()
    expect(grid?.children).toHaveLength(0)
  })
})
