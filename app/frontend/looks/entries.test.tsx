// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GithubRepositorySummary, PostSummary } from '../types/page'
import { Repositories, Section, Thoughts } from './entries'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const INTERNAL_POST: PostSummary = {
  slug: 'local-thought',
  title: 'Local Thought',
  date: '2026-01-01',
  categories: ['Creating'],
  description: 'Written at home.',
  path: '/creating/2026/01/01/local-thought/',
}

const EXTERNAL_POST: PostSummary = {
  slug: 'every-thought',
  title: 'Every Thought',
  date: '2025-12-31',
  categories: ['AI'],
  description: 'Published externally.',
  path: 'https://every.to/source-code/every-thought',
  external_url: 'https://every.to/source-code/every-thought',
}

const REPO: GithubRepositorySummary = {
  name: 'leva',
  description: 'LLM evaluation for Rails applications.',
  language: 'Ruby',
  stars: 2,
  url: 'https://github.com/kieranklaassen/leva',
}

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

describe('Thoughts', () => {
  it('renders internal links directly and external posts with target, rel, and the Every badge', () => {
    mount(<Thoughts posts={[INTERNAL_POST, EXTERNAL_POST]} room="estuary" />)

    const links = [...container.querySelectorAll<HTMLAnchorElement>('a.wc-entry')]
    expect(links).toHaveLength(2)

    const [internal, external] = links
    expect(internal.getAttribute('href')).toBe(INTERNAL_POST.path)
    expect(internal.getAttribute('data-key')).toBe(INTERNAL_POST.path)
    expect(internal.getAttribute('target')).toBeNull()
    expect(internal.getAttribute('rel')).toBeNull()
    expect(internal.textContent).not.toContain('Every ↗')

    expect(external.getAttribute('href')).toBe(EXTERNAL_POST.external_url)
    expect(external.getAttribute('data-key')).toBe(EXTERNAL_POST.external_url)
    expect(external.getAttribute('target')).toBe('_blank')
    expect(external.getAttribute('rel')).toBe('noopener noreferrer')
    expect(external.textContent).toContain('Every ↗')
  })

  it('formats dates in UTC with dateTime preserved', () => {
    mount(<Thoughts posts={[INTERNAL_POST, EXTERNAL_POST]} room="estuary" />)

    const times = [...container.querySelectorAll('time')]
    expect(times.map((node) => [node.getAttribute('dateTime'), node.textContent])).toEqual([
      ['2026-01-01', 'Jan 1, 2026'],
      ['2025-12-31', 'Dec 31, 2025'],
    ])
  })

  it('adapts entry paint and decorative spans to each room', () => {
    mount(<Thoughts posts={[INTERNAL_POST]} room="name" />)
    expect(container.querySelector('a.wc-entry')?.getAttribute('data-paint')).toBe('line')
    expect(container.querySelector('.wc-swatch')?.getAttribute('data-key')).toBe('local-thought')
    expect(container.querySelector('.wc-thumb')).toBeNull()
    expect(container.querySelector('.wc-phrase')).toBeNull()

    mount(<Thoughts posts={[INTERNAL_POST]} room="score" />)
    expect(container.querySelector('a.wc-entry')?.getAttribute('data-paint')).toBe('card')
    const thumb = container.querySelector('.wc-thumb')
    expect(thumb?.getAttribute('data-paint')).toBe('picture')
    expect(thumb?.getAttribute('data-key')).toBe('local-thought')
    expect(thumb?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.wc-swatch')).toBeNull()
    expect(container.querySelector('.wc-phrase')).toBeNull()

    mount(<Thoughts posts={[INTERNAL_POST]} room="mosaic" />)
    expect(container.querySelector('a.wc-entry')?.getAttribute('data-paint')).toBe('card')
    expect(container.querySelector('.wc-swatch')).not.toBeNull()
    const phrase = container.querySelector('.wc-phrase')
    expect(phrase?.getAttribute('data-paint')).toBe('phrase')
    expect(phrase?.getAttribute('data-key')).toBe('local-thought')
    expect(phrase?.getAttribute('data-strong')).toBe('Local Thought')
    expect(phrase?.getAttribute('data-pale')).toBe('Written at home.')
    expect(phrase?.getAttribute('aria-hidden')).toBe('true')

    mount(<Thoughts posts={[INTERNAL_POST]} room="estuary" />)
    expect(container.querySelector('a.wc-entry')?.getAttribute('data-paint')).toBe('card')
    const swatch = container.querySelector('.wc-swatch')
    expect(swatch?.getAttribute('data-paint')).toBe('swatch')
    expect(swatch?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.wc-thumb')).toBeNull()
    expect(container.querySelector('.wc-phrase')).toBeNull()
  })
})

describe('Repositories', () => {
  it('renders the fallback message when the list is empty', () => {
    mount(<Repositories repositories={[]} room="estuary" />)

    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('More code is on GitHub.')
  })

  it('renders external repository links, optional description, and singular/plural star labels', () => {
    const soloRepo: GithubRepositorySummary = {
      name: 'sketch',
      description: null,
      language: 'TypeScript',
      stars: 1,
      url: 'https://github.com/kieranklaassen/sketch',
    }
    mount(<Repositories repositories={[soloRepo, REPO]} room="estuary" />)

    const items = [...container.querySelectorAll('a.wc-entry')]
    expect(items).toHaveLength(2)

    expect(items[0].getAttribute('href')).toBe(soloRepo.url)
    expect(items[0].getAttribute('target')).toBe('_blank')
    expect(items[0].getAttribute('rel')).toBe('noopener noreferrer')
    expect(items[0].getAttribute('aria-label')).toBe('sketch on GitHub')
    expect(items[0].getAttribute('data-paint')).toBe('repo')
    expect(items[0].querySelector('p')).toBeNull()
    expect(items[0].querySelector('[aria-label="1 star"]')?.textContent).toBe('★ 1')

    expect(items[1].querySelector('p')?.textContent).toBe(REPO.description)
    expect(items[1].querySelector('[aria-label="2 stars"]')?.textContent).toBe('★ 2')
    expect(items[1].textContent).toContain('Ruby')
  })

  it('uses line paint in the name room and adds phrase metadata in the mosaic room', () => {
    const bareRepo: GithubRepositorySummary = { ...REPO, name: 'bare', description: null }

    mount(<Repositories repositories={[REPO]} room="name" />)
    expect(container.querySelector('a.wc-entry')?.getAttribute('data-paint')).toBe('line')
    expect(container.querySelector('.wc-phrase')).toBeNull()

    mount(<Repositories repositories={[REPO, bareRepo]} room="mosaic" />)
    const phrases = [...container.querySelectorAll('.wc-phrase')]
    expect(phrases).toHaveLength(2)
    expect(phrases[0].getAttribute('data-strong')).toBe('leva')
    expect(phrases[0].getAttribute('data-pale')).toBe(REPO.description)
    expect(phrases[1].getAttribute('data-strong')).toBe('bare')
    expect(phrases[1].getAttribute('data-pale')).toBe('')
  })
})

describe('Section', () => {
  it('renders heading and children without an extra heading span when more is omitted', () => {
    mount(
      <Section title="Thoughts">
        <p>Body</p>
      </Section>,
    )

    const heading = container.querySelector('h2')
    expect(heading?.textContent).toBe('Thoughts')
    expect(heading?.getAttribute('data-paint')).toBe('heading')
    expect(heading?.getAttribute('data-key')).toBe('Thoughts')
    expect(container.querySelector('.wc-heading span')).toBeNull()
    expect(container.querySelector('section > p')?.textContent).toBe('Body')
  })

  it('renders the more slot inside a heading span when supplied', () => {
    mount(
      <Section title="Code" more={<a href="/code">More</a>}>
        <p>Repos</p>
      </Section>,
    )

    const moreSpan = container.querySelector('.wc-heading span[data-paint="heading"]')
    expect(moreSpan?.querySelector('a')?.getAttribute('href')).toBe('/code')
    expect(moreSpan?.textContent).toBe('More')
  })
})
