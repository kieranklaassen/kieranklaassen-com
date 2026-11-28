// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type PropsWithChildren, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Art, Look } from '../../looks/looks'
import type { Post } from '../../types/page'

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

import PostShow, { AiAssistanceDisclosure, withInitial } from './show'

const BASE_POST: Post = {
  slug: 'compound-engineering',
  title: 'Short title',
  date: '2026-01-01',
  categories: ['Creating'],
  description: 'A thoughtful essay.',
  path: '/creating/2026/01/01/compound-engineering/',
  ai_assisted: false,
  html: '<p>Once upon a time.</p><p>Second paragraph.</p>',
}

function setPage(look?: Look, art?: Art) {
  mocks.usePage.mockReturnValue({
    props: { look, art },
    component: 'posts/show',
  })
}

describe('withInitial', () => {
  it('wraps the first letter of a leading paragraph and ignores later paragraphs', () => {
    expect(withInitial('<p>Hello world</p><p>Again</p>')).toBe(
      '<p><span class="wc-initial" data-paint="initial">H</span>ello world</p><p>Again</p>',
    )
    expect(withInitial(' \n\t<p>lowercase</p>')).toBe(
      '<p><span class="wc-initial" data-paint="initial">l</span>owercase</p>',
    )
  })

  it.each([
    '<h2>Heading first</h2><p>Body</p>',
    '<p><em>Emphasized</em></p>',
    '<p>"Quoted"</p>',
    '<p>42 answers</p>',
    '',
  ])('leaves HTML unchanged when it does not begin with a plain letter paragraph: %s', (html) => {
    expect(withInitial(html)).toBe(html)
  })
})

describe('AiAssistanceDisclosure', () => {
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
  })

  it('renders the disclosure paragraph only when visible is true', () => {
    mount(<AiAssistanceDisclosure visible={false} />)
    expect(container.innerHTML).toBe('')

    mount(<AiAssistanceDisclosure visible />)
    expect(container.querySelector('p')?.textContent).toBe(
      'AI-assisted writing. The original ideas and experiences are mine.',
    )
  })
})

describe('PostShow', () => {
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

  it('sets head metadata and renders the plain article under the blocks look', () => {
    setPage('blocks')

    mount(<PostShow post={{ ...BASE_POST, ai_assisted: true }} />)

    const head = container.querySelector('[data-testid="head"]')
    expect(head?.getAttribute('data-title')).toBe('Short title')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('A thoughtful essay.')

    expect(container.querySelector('.wc-stream')).toBeNull()
    const article = container.querySelector('article.glass-panel')
    expect(article).not.toBeNull()

    const backLink = article?.querySelector<HTMLAnchorElement>('a')
    expect(backLink?.getAttribute('href')).toBe('/')
    expect(backLink?.textContent).toBe('← All thoughts')

    expect(article?.querySelector('h2')?.textContent).toBe('Short title')
    const time = article?.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe('2026-01-01')
    expect(time?.textContent).toBe('January 1, 2026')
    expect(article?.textContent).toContain('AI-assisted writing. The original ideas and experiences are mine.')

    expect(article?.querySelector('.post-prose .wc-initial')).toBeNull()
    expect(article?.querySelector('.post-prose')?.innerHTML).toBe(BASE_POST.html)
  })

  it('renders ArtPost with picture/tail/foot chrome, /posts back link, painted initial, and --longest/--letters', () => {
    setPage('long', 'river')

    mount(<PostShow post={{ ...BASE_POST, ai_assisted: true }} />)

    const stream = container.querySelector('.wc-stream[data-paint="stream"]')
    const article = stream?.querySelector('article.wc-art[data-paint="sheet"]')
    expect(article?.getAttribute('data-key')).toBe('compound-engineering')

    const picture = article?.querySelector('.wc-picture[data-paint="picture"]')
    expect(picture?.getAttribute('data-key')).toBe('compound-engineering')
    expect(picture?.getAttribute('aria-hidden')).toBe('true')

    const backLink = article?.querySelector<HTMLAnchorElement>('a.wc-back[data-paint="quiet"]')
    expect(backLink?.getAttribute('href')).toBe('/posts')
    expect(backLink?.textContent).toBe('← All thoughts')

    const heading = article?.querySelector<HTMLHeadingElement>('h2[data-paint="title"]')
    expect(heading?.getAttribute('data-key')).toBe('compound-engineering')
    expect(heading?.style.getPropertyValue('--longest')).toBe('9')
    expect(heading?.style.getPropertyValue('--letters')).toBe(Math.sqrt('Short title'.length).toFixed(2))

    const when = article?.querySelector('.wc-when[data-paint="quiet"]')
    expect(when?.querySelector('time')?.getAttribute('dateTime')).toBe('2026-01-01')
    expect(when?.querySelector('time')?.textContent).toBe('January 1, 2026')
    expect(when?.textContent).toContain('AI-assisted writing. The original ideas and experiences are mine.')

    const initial = article?.querySelector('.wc-prose .wc-initial[data-paint="initial"]')
    expect(initial?.textContent).toBe('O')
    expect(article?.querySelector('.wc-tail[data-paint="tail"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(stream?.querySelector('.wc-foot[data-paint="foot"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it.each([
    { title: 'Tiny', longest: '9', letters: Math.sqrt(4).toFixed(2) },
    { title: 'Extraordinary thoughts', longest: '13', letters: Math.sqrt(22).toFixed(2) },
    { title: 'Self-improvement', longest: '11', letters: Math.sqrt(16).toFixed(2) },
  ])('computes --longest=$longest and --letters=$letters for ArtPost title "$title"', ({ title, longest, letters }) => {
    setPage('rooms', 'book')

    mount(<PostShow post={{ ...BASE_POST, title }} />)

    const heading = container.querySelector<HTMLHeadingElement>('article.wc-art h2')
    expect(heading?.style.getPropertyValue('--longest')).toBe(longest)
    expect(heading?.style.getPropertyValue('--letters')).toBe(letters)
  })

  it('renders PaintedPost for painted looks without article art, preserving raw prose and linking back to /', () => {
    setPage('estuary')

    mount(<PostShow post={{ ...BASE_POST, ai_assisted: false }} />)

    const stream = container.querySelector('.wc-stream[data-paint="stream"]')
    const article = stream?.querySelector('article.wc-sheet[data-paint="sheet"]')
    expect(article?.getAttribute('data-key')).toBe('compound-engineering')

    const backLink = article?.querySelector<HTMLAnchorElement>('a.wc-back')
    expect(backLink?.getAttribute('href')).toBe('/')
    expect(backLink?.textContent).toBe('← All thoughts')

    const phrase = article?.querySelector('.wc-phrase[data-paint="phrase"]')
    expect(phrase?.getAttribute('data-key')).toBe('compound-engineering')
    expect(phrase?.getAttribute('data-of')).toBe('article')
    expect(phrase?.getAttribute('aria-hidden')).toBe('true')

    const heading = article?.querySelector<HTMLHeadingElement>('h2[data-paint="title"]')
    expect(heading?.textContent).toBe('Short title')
    expect(heading?.style.getPropertyValue('--longest')).toBe('')

    expect(article?.querySelector('time')?.textContent).toBe('January 1, 2026')
    expect(article?.textContent).not.toContain('AI-assisted writing.')

    expect(article?.querySelector('.wc-prose .wc-initial')).toBeNull()
    expect(article?.querySelector('.wc-prose')?.innerHTML).toBe(BASE_POST.html)
    expect(stream?.querySelector('.wc-band[data-paint="band"][data-key="band-foot"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })
})
