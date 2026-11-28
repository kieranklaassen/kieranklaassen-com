// @vitest-environment jsdom
import { act, type PropsWithChildren, type ReactElement } from 'react'
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
}))

import About from './about'

describe('About', () => {
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

  it('sets head metadata and renders the painted sheet article with bio copy', () => {
    mount(<About />)

    const head = container.querySelector('[data-testid="head"]')
    expect(head?.getAttribute('data-title')).toBe('About')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'About Kieran Klaassen, a creator, engineer, composer, and baker.',
    )

    const article = container.querySelector('article[data-paint="sheet"][data-key="about"]')
    expect(article).not.toBeNull()
    expect(article?.classList.contains('glass-panel')).toBe(true)
    expect(article?.classList.contains('wc-sheet-plain')).toBe(true)
    expect(article?.querySelector('h2')?.textContent).toBe('About')

    const paragraphs = [...(article?.querySelectorAll('p') ?? [])].map((p) => p.textContent)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toContain("I'm Kieran, a founder and engineering leader")
    expect(paragraphs[1]).toContain('technology, creativity, leadership, and personal growth.')
  })
})
