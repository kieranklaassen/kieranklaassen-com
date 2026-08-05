// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeContent } from '../pages/home'
import type { GithubRepositorySummary } from '../types/page'
import { RepositoryList } from './repository_list'

const REPOSITORY: GithubRepositorySummary = {
  name: 'leva',
  description: 'LLM evaluation for Rails applications.',
  language: 'Ruby',
  stars: 142,
  url: 'https://github.com/kieranklaassen/leva',
}

describe('repository list', () => {
  it('renders repository metadata in a safe external link', () => {
    const markup = renderToStaticMarkup(<RepositoryList repositories={[REPOSITORY]} />)

    expect(markup).toContain('href="https://github.com/kieranklaassen/leva"')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
    expect(markup).toContain('LLM evaluation for Rails applications.')
    expect(markup).toContain('Ruby')
    expect(markup).toContain('142 stars')
    expect(markup).toContain('focus-visible:outline-2')
  })

  it('omits absent optional metadata', () => {
    const markup = renderToStaticMarkup(
      <RepositoryList repositories={[{ ...REPOSITORY, description: null, language: null }]} />,
    )

    expect(markup).not.toContain(REPOSITORY.description)
    expect(markup).not.toContain('Ruby')
    expect(markup).toContain('142 stars')
  })

  it('renders a quiet empty state', () => {
    const markup = renderToStaticMarkup(<RepositoryList repositories={[]} />)

    expect(markup).toContain('More code is on GitHub.')
  })
})

describe('home discovery links', () => {
  it('links to the complete Thoughts and Code collections', () => {
    const markup = renderToStaticMarkup(<HomeContent posts={[]} repositories={[REPOSITORY]} />)

    expect(markup).toContain('href="/posts"')
    expect(markup).toContain('href="https://github.com/kieranklaassen?tab=repositories"')
    expect(markup.match(/>More</g)).toHaveLength(2)
    expect(markup).toContain('focus-visible:outline-2')
  })
})
