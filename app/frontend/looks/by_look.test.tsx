// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { river, wide } from '../watercolor/article'
import { longPage, mosaic, score } from '../watercolor/compose'
import type { Art, Look, Rooms } from './looks'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  usePage: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  usePage: mocks.usePage,
}))

import { ByLook } from './by_look'

function setPage(page: { look?: Look; art?: Art; component: string }) {
  mocks.usePage.mockReturnValue({
    props: { look: page.look, art: page.art },
    component: page.component,
  })
}

describe('ByLook', () => {
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

  it.each<Look | undefined>([undefined, 'blocks'])(
    'renders plain children without calling painted when look is %s',
    (look) => {
      setPage({ look, component: 'home' })
      const painted = vi.fn(() => <p>Painted</p>)

      mount(
        <ByLook painted={painted}>
          <p>Plain fallback</p>
        </ByLook>,
      )

      expect(painted).not.toHaveBeenCalled()
      expect(container.textContent).toBe('Plain fallback')
    },
  )

  it('renders nothing when fallback children are omitted and no painted rooms apply', () => {
    setPage({ look: 'blocks', component: 'home' })
    const painted = vi.fn(() => <p>Painted</p>)

    mount(<ByLook painted={painted} />)

    expect(painted).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })

  it.each<{ look: Look; component: string; art?: Art; expected: Rooms }>([
    {
      look: 'long',
      component: 'home',
      expected: { head: 'name', body: 'long', compose: longPage },
    },
    {
      look: 'rooms',
      component: 'posts/index',
      expected: { head: 'score', body: 'score', compose: score },
    },
    {
      look: 'mosaic',
      component: 'about',
      expected: { head: 'mosaic', body: 'mosaic', compose: mosaic },
    },
    {
      look: 'long',
      component: 'posts/show',
      expected: { head: 'article', body: 'article', art: 'wide', compose: wide },
    },
    {
      look: 'rooms',
      component: 'posts/show',
      art: 'river',
      expected: { head: 'article', body: 'article', art: 'river', compose: river },
    },
  ])('passes resolved rooms to painted for look=$look component=$component art=$art', ({ look, component, art, expected }) => {
    setPage({ look, component, art })
    const painted = vi.fn((rooms: Rooms) => (
      <div data-head={rooms.head} data-body={rooms.body} data-art={rooms.art ?? ''}>
        Painted
      </div>
    ))

    mount(
      <ByLook painted={painted}>
        <p>Plain fallback</p>
      </ByLook>,
    )

    expect(painted).toHaveBeenCalledTimes(1)
    expect(painted).toHaveBeenCalledWith(expected)
    expect(container.textContent).toBe('Painted')
    expect(container.querySelector('div')?.getAttribute('data-body')).toBe(expected.body)
    expect(container.querySelector('div')?.getAttribute('data-art')).toBe(expected.art ?? '')
  })
})
