import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let constructed: FakeAudioContext[]

class FakeAudioContext {
  readonly id: number
  constructor() {
    this.id = constructed.length + 1
    constructed.push(this)
  }
}

beforeEach(() => {
  vi.resetModules()
  constructed = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('theContext', () => {
  it('constructs AudioContext once and returns the cached singleton on subsequent calls', async () => {
    const { theContext } = await import('./context')

    const first = theContext()
    const second = theContext()
    const third = theContext()

    expect(constructed).toHaveLength(1)
    expect(first).toBeInstanceOf(FakeAudioContext)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('sets navigator.audioSession.type to ambient on first creation when present', async () => {
    const audioSession = { type: 'playback' }
    vi.stubGlobal('navigator', { audioSession })

    const { theContext } = await import('./context')
    const first = theContext()

    expect(audioSession.type).toBe('ambient')
    expect(constructed).toHaveLength(1)

    audioSession.type = 'auto'
    const second = theContext()

    expect(second).toBe(first)
    expect(audioSession.type).toBe('auto')
    expect(constructed).toHaveLength(1)
  })

  it('works cleanly when navigator.audioSession is absent', async () => {
    vi.stubGlobal('navigator', {})

    const { theContext } = await import('./context')
    const created = theContext()

    expect(created).toBeInstanceOf(FakeAudioContext)
    expect(constructed).toHaveLength(1)
    expect(theContext()).toBe(created)
  })

  it('starts fresh with a new AudioContext after module reset', async () => {
    const firstModule = await import('./context')
    const first = firstModule.theContext()

    vi.resetModules()

    const secondModule = await import('./context')
    const second = secondModule.theContext()

    expect(second).not.toBe(first)
    expect(constructed).toHaveLength(2)
  })
})
