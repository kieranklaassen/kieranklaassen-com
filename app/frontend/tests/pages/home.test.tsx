// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Look } from '../../looks/looks'
import type { GithubRepositorySummary, PostSummary } from '../../types/page'

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

import Home, { HomeContent } from '../../pages/home'

const POSTS: PostSummary[] = [
  {
    slug: 'building-with-care',
    title: 'Building with care',
    date: '2026-02-14',
    categories: ['Creating'],
    description: 'Notes on craft.',
    path: '/creating/2026/02/14/building-with-care/',
  },
]

const SCORE_POSTS: PostSummary[] = [
  ...POSTS,
  {
    slug: 'older-note',
    title: 'Older note',
    date: '2024-06-01',
    categories: ['Writing'],
    description: 'An earlier essay.',
    path: '/writing/2024/06/01/older-note/',
  },
]

const REPOSITORIES: GithubRepositorySummary[] = [
  {
    name: 'leva',
    description: 'LLM evaluation for Rails applications.',
    language: 'Ruby',
    stars: 142,
    url: 'https://github.com/kieranklaassen/leva',
  },
]

function setLook(look?: Look) {
  mocks.usePage.mockReturnValue({
    props: { look },
    component: 'home',
  })
}

describe('Home', () => {
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

  it('renders HomeContent with Thoughts and Code collections and their More links', () => {
    mount(<HomeContent posts={POSTS} repositories={REPOSITORIES} />)

    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
    expect(headings).toEqual(['Thoughts', 'Code'])

    const thoughtsMore = container.querySelector<HTMLAnchorElement>('a[href="/posts"]')
    expect(thoughtsMore?.textContent).toBe('More')
    expect(thoughtsMore?.hasAttribute('data-inertia-link')).toBe(true)

    const codeMore = container.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/kieranklaassen?tab=repositories"]',
    )
    expect(codeMore?.textContent).toBe('More')
    expect(codeMore?.getAttribute('target')).toBe('_blank')
    expect(codeMore?.getAttribute('rel')).toBe('noopener noreferrer')

    expect(container.textContent).toContain('Building with care')
    expect(container.textContent).toContain('leva')
  })

  it('sets head metadata and falls back to HomeContent under the blocks look', () => {
    setLook('blocks')

    mount(<Home posts={POSTS} repositories={REPOSITORIES} score={SCORE_POSTS} />)

    const head = container.querySelector('[data-testid="head"]')
    expect(head?.getAttribute('data-title')).toBe('Kieran Klaassen')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Essays from Kieran Klaassen about work, life, creativity, and technology.',
    )

    expect(container.querySelector('.wc-home')).toBeNull()
    expect(container.querySelector('.wc-score')).toBeNull()
    expect(container.querySelector('a[href="/posts"]')?.textContent).toBe('More')
    expect(container.textContent).toContain('Building with care')
    expect(container.textContent).toContain('leva')
  })

  it('renders the long room with wc-first score header and wc-river lists', () => {
    setLook('long')

    mount(<Home posts={POSTS} repositories={REPOSITORIES} score={SCORE_POSTS} />)

    const first = container.querySelector('.wc-first[data-look="score"]')
    expect(first).not.toBeNull()
    expect(first?.querySelector('.wc-score')).not.toBeNull()
    expect(first?.querySelectorAll('.wc-note')).toHaveLength(2)

    const river = container.querySelector('.wc-river[data-look="estuary"][data-paint="stream"]')
    expect(river).not.toBeNull()
    expect(river?.querySelector('.wc-home')).not.toBeNull()
    expect(river?.querySelector('.wc-thoughts a.wc-entry')?.getAttribute('data-paint')).toBe('card')
    expect(river?.querySelector('.wc-repositories a.wc-entry')?.getAttribute('data-paint')).toBe('repo')
    expect(river?.querySelector('a[href="/posts"]')?.hasAttribute('data-inertia-link')).toBe(true)

    const githubMore = river?.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/kieranklaassen?tab=repositories"]',
    )
    expect(githubMore?.getAttribute('target')).toBe('_blank')
    expect(githubMore?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(container.querySelector('.wc-band[data-key="band-foot"]')).toBeNull()
  })

  it('omits Score inside wc-first for the long room when score is not provided', () => {
    setLook('long')

    mount(<Home posts={POSTS} repositories={REPOSITORIES} />)

    const first = container.querySelector('.wc-first[data-look="score"]')
    expect(first).not.toBeNull()
    expect(first?.querySelector('.wc-score')).toBeNull()
    expect(container.querySelector('.wc-river .wc-home')).not.toBeNull()
  })

  it('renders the name room with wc-first score wrapper, line-painted entries, and band-foot', () => {
    setLook('rooms')

    mount(<Home posts={POSTS} repositories={REPOSITORIES} score={SCORE_POSTS} />)

    const home = container.querySelector('.wc-home[data-paint="stream"]')
    expect(home).not.toBeNull()
    expect(container.querySelector('.wc-river')).toBeNull()

    const scoreWrap = home?.querySelector(':scope > [data-look="score"]')
    expect(scoreWrap?.className).toBe('wc-first')
    expect(scoreWrap?.querySelector('.wc-score')).not.toBeNull()

    expect(home?.querySelector('.wc-thoughts a.wc-entry')?.getAttribute('data-paint')).toBe('line')
    expect(home?.querySelector('.wc-repositories a.wc-entry')?.getAttribute('data-paint')).toBe('line')

    const band = home?.querySelector('.wc-band[data-paint="band"][data-key="band-foot"]')
    expect(band?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders default painted rooms without wc-first on the score wrapper and omits the wrapper without score', () => {
    setLook('estuary')

    mount(<Home posts={POSTS} repositories={REPOSITORIES} score={SCORE_POSTS} />)

    const scoreWrap = container.querySelector('.wc-home > [data-look="score"]')
    expect(scoreWrap).not.toBeNull()
    expect(scoreWrap?.getAttribute('class')).toBeNull()
    expect(scoreWrap?.querySelector('.wc-score')).not.toBeNull()
    expect(container.querySelector('.wc-thoughts a.wc-entry')?.getAttribute('data-paint')).toBe('card')
    expect(container.querySelector('.wc-repositories a.wc-entry')?.getAttribute('data-paint')).toBe('repo')
    expect(container.querySelector('.wc-band[data-key="band-foot"]')).not.toBeNull()

    mount(<Home posts={POSTS} repositories={REPOSITORIES} />)

    expect(container.querySelector('[data-look="score"]')).toBeNull()
    expect(container.querySelector('.wc-score')).toBeNull()
    expect(container.querySelector('.wc-band[data-key="band-foot"]')).not.toBeNull()
  })
})
