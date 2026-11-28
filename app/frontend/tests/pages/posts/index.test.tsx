// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Look } from '../../../looks/looks'
import type { PostSummary } from '../../../types/page'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  usePage: vi.fn(),
}))

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
  usePage: mocks.usePage,
}))

import PostsIndex from '../../../pages/posts/index'

const POSTS: PostSummary[] = [
  {
    slug: 'spring-2026',
    title: 'Spring 2026',
    date: '2026-04-10',
    categories: ['Creating'],
    description: 'Latest essay.',
    path: '/creating/2026/04/10/spring-2026/',
  },
  {
    slug: 'winter-2026',
    title: 'Winter 2026',
    date: '2026-01-15',
    categories: ['Writing'],
    description: 'Earlier in 2026.',
    path: '/writing/2026/01/15/winter-2026/',
  },
  {
    slug: 'autumn-2024',
    title: 'Autumn 2024',
    date: '2024-10-03',
    categories: ['Code'],
    description: 'From 2024.',
    path: '/code/2024/10/03/autumn-2024/',
  },
]

function setLook(look?: Look) {
  mocks.usePage.mockReturnValue({
    props: { look },
    component: 'posts/index',
  })
}

describe('PostsIndex', () => {
  let container: HTMLDivElement
  let root: Root

  const mount = (element: ReactElement) => act(() => root.render(element))

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.usePage.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('sets head metadata and renders plain PostList under the blocks look', () => {
    setLook('blocks')

    mount(<PostsIndex posts={POSTS} />)

    const head = container.querySelector('[data-testid="head"]')
    expect(head?.getAttribute('data-title')).toBe('Thoughts')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'All essays by Kieran Klaassen.',
    )

    expect(container.querySelector('.wc-home')).toBeNull()
    expect(container.querySelector('.wc-score')).toBeNull()
    expect(container.querySelector('h2')?.textContent).toBe('Thoughts')

    const titles = [...container.querySelectorAll('.grid h3')].map((heading) => heading.textContent)
    expect(titles).toEqual(['Spring 2026', 'Winter 2026', 'Autumn 2024'])
  })

  it('renders Score and groups posts into deduplicated year sections in the score room', () => {
    setLook('long')

    mount(<PostsIndex posts={POSTS} />)

    const home = container.querySelector('.wc-home[data-paint="stream"]')
    expect(home).not.toBeNull()
    expect(home?.querySelector('.wc-score')).not.toBeNull()
    expect(home?.querySelectorAll('.wc-note')).toHaveLength(3)

    const sections = [...(home?.querySelectorAll('section.wc-section') ?? [])]
    expect(sections.map((section) => section.querySelector('h2')?.textContent)).toEqual(['2026', '2024'])

    const titlesBySection = sections.map((section) =>
      [...section.querySelectorAll('h3')].map((heading) => heading.textContent),
    )
    expect(titlesBySection).toEqual([['Spring 2026', 'Winter 2026'], ['Autumn 2024']])

    expect(home?.querySelectorAll('.wc-thumb[data-paint="picture"]')).toHaveLength(3)
    expect(home?.querySelector('.wc-band[data-paint="band"][data-key="band-foot"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('renders a single Thoughts section without Score for other painted rooms', () => {
    setLook('mosaic')

    mount(<PostsIndex posts={POSTS} />)

    const home = container.querySelector('.wc-home[data-paint="stream"]')
    expect(home).not.toBeNull()
    expect(home?.querySelector('.wc-score')).toBeNull()

    const sections = [...(home?.querySelectorAll('section.wc-section') ?? [])]
    expect(sections).toHaveLength(1)
    expect(sections[0].querySelector('h2')?.textContent).toBe('Thoughts')
    expect([...sections[0].querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual([
      'Spring 2026',
      'Winter 2026',
      'Autumn 2024',
    ])
    expect(sections[0].querySelectorAll('.wc-phrase[data-paint="phrase"]')).toHaveLength(3)
    expect(home?.querySelector('.wc-band[data-key="band-foot"]')).not.toBeNull()
  })
})
