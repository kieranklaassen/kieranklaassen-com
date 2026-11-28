// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keepChange, keptInk } from './kept'
import { Pens } from './pens_tray'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let shell: HTMLDivElement
let root: Root
let narrow = false

const layer = () => shell.querySelector<HTMLElement>('.wc-ink')!
const inked = () => [...shell.querySelectorAll('path[data-stroke]')]
const button = (name: string) => [...shell.querySelectorAll('button')].find((one) => (one.getAttribute('aria-label') ?? one.textContent) === name)
const press = (name: string) => act(() => button(name)!.click())

function point(type: string, x: number, y: number, { id = 1, kind = 'mouse' } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.assign(event, { pointerId: id, pointerType: kind, pressure: 0.5 })
  act(() => void layer().dispatchEvent(event))
}

function draw(from: [number, number], to: [number, number]) {
  point('pointerdown', ...from)
  point('pointermove', ...to)
  point('pointerup', ...to)
}

const mount = (path = '/a') => act(() => root.render(<Pens key={path} path={path} />))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  narrow = false
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) })
  vi.stubGlobal('matchMedia', () => ({ matches: narrow }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 1000))
  shell = document.createElement('div')
  Object.defineProperties(shell, { clientWidth: { value: 1000 }, scrollHeight: { value: 1000 } })
  document.body.append(shell)
  root = createRoot(shell)
  mount()
})

afterEach(() => {
  act(() => root.unmount())
  shell.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Pens', () => {
  it('is served as a button and bare paper', () => {
    const markup = renderToStaticMarkup(<Pens path="/a" />)
    expect(markup).toContain('aria-label="Pens"')
    expect(markup).not.toContain('data-stroke')
  })

  it('takes up a pen and puts it down by pressing it again, by Escape and by Put down', () => {
    press('Pens')
    press('Marker')
    expect(button('Marker')!.getAttribute('aria-pressed')).toBe('true')
    expect(layer().dataset.held).toBe('marker')
    press('Marker')
    expect(layer().dataset.held).toBeUndefined()

    press('Pencil')
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(layer().dataset.held).toBeUndefined()

    press('Brush pen')
    press('Pens, holding the brush pen')
    expect(button('Pencil')).toBeUndefined()
    expect(layer().dataset.held).toBe('brush')
    press('Put down')
    expect(layer().dataset.held).toBeUndefined()
  })

  it('draws nothing while no pen is held', () => {
    draw([10, 10], [200, 100])
    expect(inked()).toHaveLength(0)
  })

  it('draws a stroke, keeps it for its page, and takes it back', () => {
    press('Pens')
    press('Fineliner')
    press('Red ink')
    draw([10, 10], [200, 100])
    expect(inked()).toHaveLength(1)
    expect(inked()[0].getAttribute('stroke')).toBe('#b4473a')
    expect(keptInk('/a')).toHaveLength(1)

    mount('/b')
    expect(inked()).toHaveLength(0)
    mount('/a')
    expect(inked()).toHaveLength(1)

    press('Pens')
    press('Highlighter')
    draw([300, 300], [400, 400])
    expect(keptInk('/a')).toHaveLength(2)
    press('Undo')
    expect(keptInk('/a')).toHaveLength(1)
  })

  it('erases what it touches and nothing else, and can take that back', () => {
    press('Pens')
    press('Marker')
    draw([10, 10], [200, 10])
    draw([10, 300], [200, 300])
    press('Eraser')
    draw([100, 0], [100, 40])
    expect(inked()).toHaveLength(1)
    press('Undo')
    expect(inked()).toHaveLength(2)
    expect(keptInk('/a')).toHaveLength(2)
  })

  it('erases in one movement what one press of Undo brings back', () => {
    press('Pens')
    press('Marker')
    draw([10, 10], [200, 10])
    draw([10, 300], [200, 300])
    press('Eraser')
    point('pointerdown', 100, 0)
    point('pointermove', 100, 40)
    point('pointermove', 100, 320)
    point('pointerup', 100, 320)
    expect(inked()).toHaveLength(0)
    press('Undo')
    expect(inked()).toHaveLength(2)
  })

  it('brings back what a finger erased when it was the first of two', () => {
    vi.stubGlobal('scrollBy', vi.fn())
    press('Pens')
    press('Marker')
    draw([10, 10], [200, 10])
    press('Eraser')
    point('pointerdown', 100, 10, { id: 1, kind: 'touch' })
    expect(inked()).toHaveLength(0)
    point('pointerdown', 300, 400, { id: 2, kind: 'touch' })
    expect(inked()).toHaveLength(1)
    expect(keptInk('/a')).toHaveLength(1)
    point('pointerup', 100, 10, { id: 1, kind: 'touch' })
    point('pointerup', 300, 400, { id: 2, kind: 'touch' })
    press('Undo')
    expect(inked()).toHaveLength(0)
  })

  it('clears what another tab has drawn since, too', () => {
    press('Pens')
    press('Marker')
    draw([10, 10], [200, 10])
    const [mine] = keptInk('/a')
    keepChange('/a', { added: [{ ...mine, id: 'theirs' }], removed: [] })
    press('Clear page')
    expect(keptInk('/a')).toEqual([])
    press('Undo')
    expect(keptInk('/a')).toHaveLength(2)
  })

  it('clears the page, and can take that back', () => {
    press('Pens')
    press('Marker')
    draw([10, 10], [200, 10])
    draw([10, 300], [200, 300])
    press('Clear page')
    expect(inked()).toHaveLength(0)
    expect(keptInk('/a')).toEqual([])
    press('Undo')
    expect(inked()).toHaveLength(2)
  })

  it('leaves nothing of a stroke that is called off', () => {
    press('Pens')
    press('Marker')
    point('pointerdown', 10, 10)
    point('pointermove', 90, 90)
    point('pointercancel', 90, 90)
    point('pointerup', 90, 90)
    expect(inked()).toHaveLength(0)
    expect(shell.querySelector('.wc-ink svg')).toBeNull()
  })

  it('scrolls with two fingers instead of drawing, until both are lifted', () => {
    const scrolled = vi.fn()
    vi.stubGlobal('scrollBy', scrolled)
    press('Pens')
    press('Marker')
    const finger = (id: number) => ({ id, kind: 'touch' })
    point('pointerdown', 100, 400, finger(1))
    point('pointermove', 100, 390, finger(1))
    point('pointerdown', 200, 400, finger(2))
    point('pointermove', 200, 340, finger(2))
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ top: 30 }))
    point('pointerup', 200, 340, finger(2))
    point('pointermove', 100, 300, finger(1))
    point('pointerup', 100, 300, finger(1))
    expect(inked()).toHaveLength(0)

    point('pointerdown', 100, 100, finger(3))
    point('pointermove', 180, 100, finger(3))
    point('pointerup', 180, 100, finger(3))
    expect(inked()).toHaveLength(1)
  })

  it('folds when Sound unfolds on a narrow window, and keeps the pen', () => {
    press('Pens')
    press('Pencil')
    const unfolded = () => act(() => void window.dispatchEvent(new CustomEvent('wc:unfolded', { detail: 'sound' })))
    unfolded()
    expect(button('Pencil')).toBeDefined()
    narrow = true
    unfolded()
    expect(button('Pencil')).toBeUndefined()
    expect(layer().dataset.held).toBe('pencil')
  })
})
