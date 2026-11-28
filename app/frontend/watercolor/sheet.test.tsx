// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Compose } from './compose'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  laySheet: vi.fn(),
  seedOfVisit: vi.fn(),
}))

vi.mock('./lay', () => ({
  laySheet: mocks.laySheet,
  seedOfVisit: mocks.seedOfVisit,
}))

import { PaintedSheet } from './sheet'

const makeCompose = (): Compose => () => ({ washes: [], paper: [1, 1, 1] })

describe('PaintedSheet', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.laySheet.mockReset()
    mocks.seedOfVisit.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('mounts laySheet on the decorative holder div with the visit seed and runs cleanup on unmount', () => {
    const cleanup = vi.fn()
    mocks.seedOfVisit.mockReturnValue(4242)
    mocks.laySheet.mockReturnValue(cleanup)
    const compose = makeCompose()

    act(() => root.render(<PaintedSheet compose={compose} page="/" />))

    const holder = container.querySelector('div.painted-sheet')
    expect(holder).not.toBeNull()
    expect(holder?.getAttribute('aria-hidden')).toBe('true')
    expect(mocks.seedOfVisit).toHaveBeenCalledTimes(1)
    expect(mocks.laySheet).toHaveBeenCalledTimes(1)
    expect(mocks.laySheet).toHaveBeenCalledWith(holder, compose, 4242)
    expect(cleanup).not.toHaveBeenCalled()

    act(() => root.unmount())

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('reuses a single seedOfVisit across page and compose changes and invokes each prior cleanup', () => {
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const thirdCleanup = vi.fn()
    mocks.seedOfVisit.mockReturnValueOnce(9001).mockReturnValueOnce(9999)
    mocks.laySheet
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(secondCleanup)
      .mockReturnValueOnce(thirdCleanup)

    const firstCompose = makeCompose()
    const secondCompose = makeCompose()

    act(() => root.render(<PaintedSheet compose={firstCompose} page="/posts" />))
    const holder = container.querySelector('div.painted-sheet')
    expect(mocks.seedOfVisit).toHaveBeenCalledTimes(1)
    expect(mocks.laySheet).toHaveBeenNthCalledWith(1, holder, firstCompose, 9001)

    act(() => root.render(<PaintedSheet compose={firstCompose} page="/about" />))
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).not.toHaveBeenCalled()
    expect(mocks.seedOfVisit).toHaveBeenCalledTimes(1)
    expect(mocks.laySheet).toHaveBeenNthCalledWith(2, holder, firstCompose, 9001)

    act(() => root.render(<PaintedSheet compose={secondCompose} page="/about" />))
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).toHaveBeenCalledTimes(1)
    expect(thirdCleanup).not.toHaveBeenCalled()
    expect(mocks.seedOfVisit).toHaveBeenCalledTimes(1)
    expect(mocks.laySheet).toHaveBeenNthCalledWith(3, holder, secondCompose, 9001)

    act(() => root.unmount())
    expect(thirdCleanup).toHaveBeenCalledTimes(1)
  })

  it('does not re-run laySheet when re-rendered with identical compose and page props', () => {
    const cleanup = vi.fn()
    mocks.seedOfVisit.mockReturnValue(77)
    mocks.laySheet.mockReturnValue(cleanup)
    const compose = makeCompose()

    act(() => root.render(<PaintedSheet compose={compose} page="/same" />))
    act(() => root.render(<PaintedSheet compose={compose} page="/same" />))

    expect(mocks.laySheet).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('handles laySheet returning undefined cleanly across prop updates and unmount', () => {
    mocks.seedOfVisit.mockReturnValue(12)
    mocks.laySheet.mockReturnValue(undefined)
    const compose = makeCompose()

    act(() => root.render(<PaintedSheet compose={compose} page="/a" />))
    act(() => root.render(<PaintedSheet compose={compose} page="/b" />))
    expect(mocks.laySheet).toHaveBeenCalledTimes(2)
    expect(() => act(() => root.unmount())).not.toThrow()
  })

  it('loads the room composer lazily and skips re-running when re-rendered with an equal room layout', async () => {
    const cleanup = vi.fn()
    mocks.seedOfVisit.mockReturnValue(314)
    mocks.laySheet.mockReturnValue(cleanup)

    act(() => root.render(<PaintedSheet room={{ head: 'name', body: 'long' }} page="/" />))
    act(() => root.render(<PaintedSheet room={{ head: 'name', body: 'long' }} page="/" />))

    expect(mocks.laySheet).toHaveBeenCalledTimes(1)
    const [, source, seed] = mocks.laySheet.mock.calls[0]
    expect(seed).toBe(314)
    expect(source).toBeInstanceOf(Promise)
    const resolved = await source
    expect(typeof resolved).toBe('function')
    expect(cleanup).not.toHaveBeenCalled()

    act(() => root.unmount())
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
