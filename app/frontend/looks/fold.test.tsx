// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnfold } from './fold'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

function Corner({ mine }: { mine: 'pens' | 'sound' }) {
  const [open, toggle] = useUnfold(mine)
  return (
    <button type="button" data-mine={mine} aria-expanded={open} onClick={toggle}>
      {open ? 'open' : 'closed'}
    </button>
  )
}

let container: HTMLDivElement
let root: Root
let narrow = false
let matchMediaSpy: ReturnType<typeof vi.fn>

const buttonOf = (mine: 'pens' | 'sound') => container.querySelector<HTMLButtonElement>(`button[data-mine="${mine}"]`)!
const click = (mine: 'pens' | 'sound') => act(() => buttonOf(mine).click())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  narrow = false
  matchMediaSpy = vi.fn((query: string) => ({ matches: query === '(max-width: 640px)' && narrow }))
  vi.stubGlobal('matchMedia', matchMediaSpy)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useUnfold', () => {
  it('starts closed and dispatches wc:unfolded only when opening', () => {
    const details: string[] = []
    const onUnfolded = (event: Event) => details.push((event as CustomEvent<string>).detail)
    window.addEventListener('wc:unfolded', onUnfolded)

    try {
      act(() => root.render(<Corner mine="pens" />))
      expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('false')

      click('pens')
      expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('true')
      expect(details).toEqual(['pens'])

      click('pens')
      expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('false')
      expect(details).toEqual(['pens'])
    } finally {
      window.removeEventListener('wc:unfolded', onUnfolded)
    }
  })

  it('closes on the other corner unfolding only when the viewport is narrow', () => {
    act(() => {
      root.render(
        <>
          <Corner mine="pens" />
          <Corner mine="sound" />
        </>,
      )
    })

    click('pens')
    expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('true')

    click('sound')
    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 640px)')
    expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('true')
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('true')

    click('sound')
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('false')

    narrow = true
    click('sound')
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('true')
    expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('false')

    click('pens')
    expect(buttonOf('pens').getAttribute('aria-expanded')).toBe('true')
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('false')
  })

  it('stays open when receiving wc:unfolded with its own detail on a narrow viewport', () => {
    narrow = true
    act(() => root.render(<Corner mine="sound" />))

    click('sound')
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('true')
    matchMediaSpy.mockClear()

    act(() => void window.dispatchEvent(new CustomEvent('wc:unfolded', { detail: 'sound' })))
    expect(buttonOf('sound').getAttribute('aria-expanded')).toBe('true')
    expect(matchMediaSpy).not.toHaveBeenCalled()
  })

  it('removes its window listener on unmount', () => {
    narrow = true
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    act(() => root.render(<Corner mine="pens" />))
    click('pens')
    matchMediaSpy.mockClear()

    act(() => root.unmount())
    expect(removeSpy).toHaveBeenCalledWith('wc:unfolded', expect.any(Function))

    window.dispatchEvent(new CustomEvent('wc:unfolded', { detail: 'sound' }))
    expect(matchMediaSpy).not.toHaveBeenCalled()
  })
})
