// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ear } from '../sound/ear'
import type { PostSummary } from '../types/page'
import type { Note, Timed } from './player'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mockInstrument = vi.hoisted(() => {
  const instances: FakeInstrument[] = []
  let possible = true
  let readyGate: (() => Promise<void>) | undefined

  class FakeInstrument {
    lasts = 28
    ready = vi.fn(() => (readyGate ? readyGate() : Promise.resolve()))
    play = vi.fn((notes: Timed[], ended: () => void) => {
      this.playedNotes = notes
      this.endedCallback = ended
    })
    strike = vi.fn((_note: Note, _at?: number) => {})
    stop = vi.fn(() => {
      const ended = this.endedCallback
      this.endedCallback = undefined
      ended?.()
    })
    close = vi.fn(() => {
      this.stop()
    })
    playedNotes: Timed[] = []
    endedCallback: (() => void) | undefined

    static get possible() {
      return possible
    }

    constructor() {
      instances.push(this)
    }
  }

  return {
    FakeInstrument,
    instances,
    setPossible: (value: boolean) => {
      possible = value
    },
    setReadyGate: (gate?: () => Promise<void>) => {
      readyGate = gate
    },
    reset: () => {
      instances.length = 0
      possible = true
      readyGate = undefined
    },
  }
})

vi.mock('./player', () => ({
  Instrument: mockInstrument.FakeInstrument,
}))

import { Score } from './score'

function makePost(overrides: Partial<PostSummary> & Pick<PostSummary, 'slug' | 'date'>): PostSummary {
  return {
    title: overrides.slug,
    categories: ['Creating'],
    description: `${overrides.slug} description`,
    path: `/posts/${overrides.slug}/`,
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

const mount = (posts: PostSummary[]) => act(() => root.render(<Score posts={posts} />))
const notes = () => [...container.querySelectorAll<HTMLAnchorElement>('a.wc-note')]
const button = (label: string) => [...container.querySelectorAll('button')].find((one) => one.textContent === label)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mockInstrument.reset()
  delete ear.playing
  delete ear.hush
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  delete ear.playing
  delete ear.hush
  mockInstrument.reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Score', () => {
  it('maps each category pattern to its lane and falls back to lane 1 when none match', () => {
    const posts: PostSummary[] = [
      makePost({ slug: 'p0', date: '2024-01-01', categories: ['Music'] }),
      makePost({ slug: 'p1', date: '2024-02-01', categories: ['Creativity'] }),
      makePost({ slug: 'p2', date: '2024-03-01', categories: ['Writing'] }),
      makePost({ slug: 'p3', date: '2024-04-01', categories: ['Breathwork'] }),
      makePost({ slug: 'p4', date: '2024-05-01', categories: ['Productivity'] }),
      makePost({ slug: 'p5', date: '2024-06-01', categories: ['Leadership'] }),
      makePost({ slug: 'p6', date: '2024-07-01', categories: ['Technology'] }),
      makePost({ slug: 'p7', date: '2024-08-01', categories: ['Unknown', 'Ruby'] }),
      makePost({ slug: 'p-default', date: '2024-09-01', categories: ['Rails'] }),
      makePost({ slug: 'p-empty', date: '2024-10-01', categories: [] }),
    ]
    mount(posts)

    const lanes = notes().map((node) => Number(node.getAttribute('data-note')!.split(' ')[0]))
    expect(lanes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 1, 1])
    expect(container.querySelector('.wc-staff')?.getAttribute('data-lanes')).toBe('8')
  })

  it('sets link attributes for internal vs external posts and assigns left/right side by position', () => {
    const posts: PostSummary[] = [
      makePost({ slug: 'early', date: '2020-01-01', title: 'Early' }),
      makePost({
        slug: 'late',
        date: '2026-01-01',
        title: 'Late',
        path: 'https://every.to/source-code/late',
        external_url: 'https://every.to/source-code/late',
      }),
    ]
    mount(posts)

    const [early, late] = notes()
    expect(early.getAttribute('href')).toBe('/posts/early/')
    expect(early.getAttribute('target')).toBeNull()
    expect(early.getAttribute('rel')).toBeNull()
    expect(early.getAttribute('data-side')).toBe('left')

    expect(late.getAttribute('href')).toBe('https://every.to/source-code/late')
    expect(late.getAttribute('target')).toBe('_blank')
    expect(late.getAttribute('rel')).toBe('noopener noreferrer')
    expect(late.getAttribute('data-side')).toBe('right')
  })

  it('renders year ticks and marks only crowded interior years with data-crowded', () => {
    const posts: PostSummary[] = [
      ...Array.from({ length: 10 }, (_, i) => makePost({ slug: `y20-${i}`, date: `2020-01-${String(i + 1).padStart(2, '0')}` })),
      makePost({ slug: 'y21', date: '2021-01-01' }),
      makePost({ slug: 'y22', date: '2022-01-01' }),
      ...Array.from({ length: 10 }, (_, i) => makePost({ slug: `y26-${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}` })),
    ]
    mount(posts)

    const ticks = [...container.querySelectorAll<HTMLLIElement>('.wc-years li[data-paint="tick"]')]
    expect(ticks.map((tick) => tick.textContent)).toEqual(['2020', '2021', '2022', '2026'])
    expect(ticks.map((tick) => tick.hasAttribute('data-crowded'))).toEqual([false, true, false, false])
  })

  it('does nothing on play when Web Audio is unavailable', async () => {
    mockInstrument.setPossible(false)
    const hush = vi.fn()
    ear.hush = hush
    mount([makePost({ slug: 'solo', date: '2025-01-01' })])

    await act(async () => {
      button('Play the score')!.click()
      await Promise.resolve()
    })

    expect(mockInstrument.instances).toHaveLength(0)
    expect(ear.playing).toBeUndefined()
    expect(hush).not.toHaveBeenCalled()
    expect(button('Play the score')?.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('.wc-hand')).toBeNull()
  })

  it('plays the score, marks heard notes with wc:heard events, and cleans up on stop', async () => {
    const hush = vi.fn()
    ear.hush = hush
    const heardKeys: string[] = []
    const onHeard = (event: Event) => {
      const target = event.target as HTMLElement
      heardKeys.push(target.getAttribute('data-key') ?? '')
    }
    container.addEventListener('wc:heard', onHeard)

    const posts: PostSummary[] = [
      makePost({ slug: 'first', date: '2024-01-01', title: 'First note', categories: ['Writing'] }),
      makePost({ slug: 'second', date: '2025-01-01', title: 'Second', categories: ['Code'] }),
    ]
    mount(posts)

    await act(async () => {
      button('Play the score')!.click()
      await Promise.resolve()
    })

    expect(mockInstrument.instances).toHaveLength(1)
    const [inst] = mockInstrument.instances
    expect(inst.ready).toHaveBeenCalledTimes(1)
    expect(inst.play).toHaveBeenCalledTimes(1)
    expect(ear.playing).toBe(true)
    expect(hush).toHaveBeenCalledWith(true)
    expect(button('Stop')?.getAttribute('aria-pressed')).toBe('true')
    expect(button('Sound off')).toBeUndefined()
    expect(container.querySelector<HTMLElement>('.wc-hand')?.style.animationDuration).toBe('28s')

    expect(inst.playedNotes).toHaveLength(2)
    expect(inst.playedNotes[0]).toMatchObject({ lane: 2, year: 0, length: 'First note'.length })
    expect(inst.playedNotes[1]).toMatchObject({ lane: 7, year: 1, length: 'Second'.length })

    const [firstNote, secondNote] = notes()
    act(() => inst.playedNotes[0].heard())
    expect(firstNote.hasAttribute('data-heard')).toBe(true)
    expect(secondNote.hasAttribute('data-heard')).toBe(false)
    expect(heardKeys).toEqual(['first'])

    act(() => inst.playedNotes[1].heard())
    expect(firstNote.hasAttribute('data-heard')).toBe(false)
    expect(secondNote.hasAttribute('data-heard')).toBe(true)
    expect(heardKeys).toEqual(['first', 'second'])

    act(() => button('Stop')!.click())
    expect(inst.stop).toHaveBeenCalledTimes(1)
    expect(secondNote.hasAttribute('data-heard')).toBe(false)
    expect(ear.playing).toBe(false)
    expect(hush).toHaveBeenLastCalledWith(false)
    expect(button('Play the score')?.getAttribute('aria-pressed')).toBe('false')
    expect(button('Sound off')).toBeDefined()
    expect(container.querySelector('.wc-hand')).toBeNull()
  })

  it('aborts playback start if ear.playing is cleared while ready() is pending', async () => {
    let resolveReady!: () => void
    mockInstrument.setReadyGate(() => new Promise<void>((resolve) => {
      resolveReady = resolve
    }))
    const hush = vi.fn()
    ear.hush = hush
    mount([makePost({ slug: 'pending', date: '2025-01-01' })])

    act(() => button('Play the score')!.click())
    expect(ear.playing).toBe(true)

    ear.playing = false
    await act(async () => {
      resolveReady()
      await Promise.resolve()
    })

    const [inst] = mockInstrument.instances
    expect(inst.play).not.toHaveBeenCalled()
    expect(hush).not.toHaveBeenCalled()
  })

  it('strikes notes on pointer enter and focus only when sounding and not playing, and resets on Sound off', async () => {
    const heardKeys: string[] = []
    container.addEventListener('wc:heard', (event) => {
      heardKeys.push((event.target as HTMLElement).getAttribute('data-key') ?? '')
    })

    const posts: PostSummary[] = [
      makePost({ slug: 'alpha', date: '2024-01-01', title: 'Alpha', categories: ['Music'] }),
      makePost({ slug: 'beta', date: '2025-01-01', title: 'Beta note', categories: ['Code'] }),
    ]
    mount(posts)

    const [alpha, beta] = notes()
    const enter = (el: HTMLElement) => act(() => void el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })))
    const focus = (el: HTMLElement) =>
      act(() => {
        el.blur()
        el.focus()
      })

    enter(alpha)
    focus(beta)
    expect(mockInstrument.instances).toHaveLength(0)
    expect(heardKeys).toEqual([])

    await act(async () => {
      button('Play the score')!.click()
      await Promise.resolve()
    })

    const [inst] = mockInstrument.instances
    enter(alpha)
    focus(beta)
    expect(inst.strike).not.toHaveBeenCalled()
    expect(heardKeys).toEqual([])

    act(() => button('Stop')!.click())

    enter(alpha)
    expect(inst.strike).toHaveBeenCalledTimes(1)
    expect(inst.strike).toHaveBeenLastCalledWith({ lane: 0, year: 0, length: 5 }, expect.closeTo(0.02, 4))
    expect(heardKeys).toEqual(['alpha'])

    focus(beta)
    expect(inst.strike).toHaveBeenCalledTimes(2)
    expect(inst.strike).toHaveBeenLastCalledWith({ lane: 7, year: 1, length: 9 }, expect.closeTo(0.93, 4))
    expect(heardKeys).toEqual(['alpha', 'beta'])

    act(() => button('Sound off')!.click())
    expect(inst.close).toHaveBeenCalledTimes(1)
    expect(button('Sound off')).toBeUndefined()

    enter(alpha)
    focus(beta)
    expect(inst.strike).toHaveBeenCalledTimes(2)
    expect(heardKeys).toEqual(['alpha', 'beta'])

    await act(async () => {
      button('Play the score')!.click()
      await Promise.resolve()
    })
    expect(mockInstrument.instances).toHaveLength(2)
  })

  it('closes the active instrument on unmount', async () => {
    mount([makePost({ slug: 'closing', date: '2025-01-01' })])

    await act(async () => {
      button('Play the score')!.click()
      await Promise.resolve()
    })

    const [inst] = mockInstrument.instances
    act(() => root.unmount())
    expect(inst.close).toHaveBeenCalledTimes(1)
  })
})
