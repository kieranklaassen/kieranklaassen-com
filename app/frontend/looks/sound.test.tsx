// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { placeOf } from '../sound/place'
import type { Part } from '../sound/studio'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const switchState = vi.hoisted(() => {
  const ALL = { music: true, weather: true, paint: true }
  const NAMES: [Part, string][] = [
    ['music', 'Music'],
    ['weather', 'Weather'],
    ['paint', 'Paint'],
  ]
  const listeners = new Set<() => void>()
  let isSounding = false
  let armedCallback: (() => void) | undefined
  let armCleanup = vi.fn()

  const setSounding = (next: boolean) => {
    isSounding = next
    listeners.forEach((listener) => listener())
  }

  return {
    ALL,
    NAMES,
    listeners,
    setSounding,
    getArmed: () => armedCallback,
    getArmCleanup: () => armCleanup,
    reset() {
      isSounding = false
      listeners.clear()
      armedCallback = undefined
      armCleanup = vi.fn()
      this.arm.mockClear()
      this.close.mockClear()
      this.fade.mockClear()
      this.keep.mockClear()
      this.kept.mockReset().mockReturnValue({ ...ALL })
      this.listen.mockClear()
      this.moveTo.mockClear()
      this.open.mockReset().mockImplementation(async () => {
        setSounding(true)
      })
      this.sounding.mockClear()
      this.turn.mockClear()
      this.want.mockClear()
    },
    arm: vi.fn((callback: () => void) => {
      armedCallback = callback
      const cleanup = vi.fn()
      armCleanup = cleanup
      return cleanup
    }),
    close: vi.fn(() => {
      setSounding(false)
    }),
    fade: vi.fn(),
    keep: vi.fn(),
    kept: vi.fn(() => ({ ...ALL })),
    listen: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }),
    moveTo: vi.fn(),
    open: vi.fn(async () => {
      setSounding(true)
    }),
    sounding: vi.fn(() => isSounding),
    turn: vi.fn(),
    want: vi.fn(),
  }
})

vi.mock('../sound/switch', () => ({
  ALL: switchState.ALL,
  NAMES: switchState.NAMES,
  arm: switchState.arm,
  close: switchState.close,
  fade: switchState.fade,
  keep: switchState.keep,
  kept: switchState.kept,
  listen: switchState.listen,
  moveTo: switchState.moveTo,
  open: switchState.open,
  sounding: switchState.sounding,
  turn: switchState.turn,
  want: switchState.want,
}))

import { Sound } from './sound'

import { roomsOf } from './looks'

const HOME_ROOMS = roomsOf('long', 'home')!
const ARTICLE_ROOMS = roomsOf('long', 'posts/show', 'river')!

describe('Sound', () => {
  let container: HTMLDivElement
  let root: Root
  let originalHidden: PropertyDescriptor | undefined

  const setDocumentHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
  }

  const toggleButton = () => {
    const buttons = container.querySelectorAll<HTMLButtonElement>('.wc-sound > button')
    return buttons[buttons.length - 1]
  }

  const moreButton = () => container.querySelector<HTMLButtonElement>('button.wc-more')
  const partButtons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button.wc-part'))

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
    switchState.reset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
    else Reflect.deleteProperty(document, 'hidden')
    vi.restoreAllMocks()
  })

  it('starts in the off state without rings or part controls', () => {
    act(() => root.render(<Sound rooms={HOME_ROOMS} url="/" />))

    const button = toggleButton()
    expect(button.textContent).toBe('Sound')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('.wc-rings')).toBeNull()
    expect(moreButton()).toBeNull()
    expect(partButtons()).toHaveLength(0)
    expect(switchState.moveTo).not.toHaveBeenCalled()
  })

  it('toggles sound on and off on press and dispatches wc:again when opening', async () => {
    const saved = { music: true, weather: false, paint: true }
    switchState.kept.mockReturnValue(saved)
    const again = vi.fn()
    window.addEventListener('wc:again', again)

    try {
      act(() => root.render(<Sound rooms={HOME_ROOMS} url="/about" />))

      await act(async () => {
        toggleButton().click()
      })

      expect(switchState.want).toHaveBeenCalledWith(true)
      expect(switchState.open).toHaveBeenCalledWith(placeOf(HOME_ROOMS, '/about'), saved)
      expect(again).toHaveBeenCalledTimes(1)
      expect(toggleButton().textContent).toBe('Sound off')
      expect(toggleButton().getAttribute('aria-pressed')).toBe('true')
      expect(container.querySelector('.wc-rings')).not.toBeNull()
      expect(moreButton()?.getAttribute('aria-expanded')).toBe('false')

      await act(async () => {
        toggleButton().click()
      })

      expect(switchState.want).toHaveBeenCalledWith(false)
      expect(switchState.close).toHaveBeenCalledTimes(1)
      expect(switchState.open).toHaveBeenCalledTimes(1)
      expect(again).toHaveBeenCalledTimes(1)
      expect(toggleButton().textContent).toBe('Sound')
      expect(toggleButton().getAttribute('aria-pressed')).toBe('false')
      expect(moreButton()).toBeNull()
    } finally {
      window.removeEventListener('wc:again', again)
    }
  })

  it('arms auto-start to open slowly with kept parts and cleans up on navigation or unmount', async () => {
    const saved = { music: false, weather: true, paint: true }
    switchState.kept.mockReturnValue(saved)
    const again = vi.fn()
    window.addEventListener('wc:again', again)

    try {
      act(() => root.render(<Sound rooms={ARTICLE_ROOMS} url="/posts/river-song" />))
      const firstCleanup = switchState.getArmCleanup()

      await act(async () => {
        switchState.getArmed()?.()
      })

      expect(switchState.open).toHaveBeenCalledWith(placeOf({ art: 'river', body: 'article' }, '/posts/river-song'), saved, true)
      expect(again).not.toHaveBeenCalled()
      expect(toggleButton().getAttribute('aria-pressed')).toBe('true')

      act(() => moreButton()?.click())
      expect(partButtons().map((button) => [button.textContent, button.getAttribute('aria-pressed')])).toEqual([
        ['Music', 'false'],
        ['Weather', 'true'],
        ['Paint', 'true'],
      ])

      act(() => root.render(<Sound rooms={HOME_ROOMS} url="/about" />))
      expect(firstCleanup).toHaveBeenCalledTimes(1)
      const secondCleanup = switchState.getArmCleanup()

      act(() => root.unmount())
      expect(secondCleanup).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('wc:again', again)
    }
  })

  it('moves place when rooms or url change only while sound is on', async () => {
    act(() => root.render(<Sound rooms={HOME_ROOMS} url="/" />))
    act(() => root.render(<Sound rooms={ARTICLE_ROOMS} url="/posts/bread" />))
    expect(switchState.moveTo).not.toHaveBeenCalled()

    await act(async () => {
      toggleButton().click()
    })
    expect(switchState.moveTo).toHaveBeenLastCalledWith(placeOf(ARTICLE_ROOMS, '/posts/bread'))

    act(() => root.render(<Sound rooms={ARTICLE_ROOMS} url="/posts/rails" />))
    expect(switchState.moveTo).toHaveBeenLastCalledWith(placeOf(ARTICLE_ROOMS, '/posts/rails'))

    act(() => root.render(<Sound rooms={HOME_ROOMS} url="/posts/rails" />))
    expect(switchState.moveTo).toHaveBeenLastCalledWith(placeOf(HOME_ROOMS, '/posts/rails'))

    const callsBeforeOff = switchState.moveTo.mock.calls.length
    await act(async () => {
      toggleButton().click()
    })
    act(() => root.render(<Sound rooms={ARTICLE_ROOMS} url="/posts/other" />))
    expect(switchState.moveTo).toHaveBeenCalledTimes(callsBeforeOff)
  })

  it('fades on visibilitychange only while on and removes its listener on close and unmount', async () => {
    act(() => root.render(<Sound rooms={HOME_ROOMS} url="/" />))

    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(switchState.fade).not.toHaveBeenCalled()

    await act(async () => {
      toggleButton().click()
    })

    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(switchState.fade).toHaveBeenNthCalledWith(1, false)

    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(switchState.fade).toHaveBeenNthCalledWith(2, true)

    await act(async () => {
      toggleButton().click()
    })
    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(switchState.fade).toHaveBeenCalledTimes(2)

    await act(async () => {
      toggleButton().click()
    })
    act(() => root.unmount())
    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(switchState.fade).toHaveBeenCalledTimes(2)
  })

  it('expands the parts panel and flips individual parts with keep and turn', async () => {
    switchState.kept.mockReturnValue({ music: true, weather: false, paint: true })
    act(() => root.render(<Sound rooms={HOME_ROOMS} url="/" />))

    await act(async () => {
      toggleButton().click()
    })

    expect(moreButton()?.getAttribute('aria-expanded')).toBe('false')
    expect(partButtons()).toHaveLength(0)

    act(() => moreButton()?.click())
    expect(moreButton()?.getAttribute('aria-expanded')).toBe('true')
    expect(partButtons().map((button) => [button.textContent, button.getAttribute('aria-pressed')])).toEqual([
      ['Music', 'true'],
      ['Weather', 'false'],
      ['Paint', 'true'],
    ])

    act(() => partButtons()[1].click())
    expect(partButtons()[1].getAttribute('aria-pressed')).toBe('true')
    expect(switchState.keep).toHaveBeenLastCalledWith({ music: true, weather: true, paint: true })
    expect(switchState.turn).toHaveBeenLastCalledWith('weather', true)

    act(() => partButtons()[0].click())
    expect(partButtons()[0].getAttribute('aria-pressed')).toBe('false')
    expect(switchState.keep).toHaveBeenLastCalledWith({ music: false, weather: true, paint: true })
    expect(switchState.turn).toHaveBeenLastCalledWith('music', false)

    act(() => moreButton()?.click())
    expect(moreButton()?.getAttribute('aria-expanded')).toBe('false')
    expect(partButtons()).toHaveLength(0)
  })
})
