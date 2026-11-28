import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '../../../vendor/engine/engine.js'

interface TrackOptions {
  name: string
  device: Device
  destination: AudioNode
  context: BaseAudioContext
}

const engine = vi.hoisted(() => {
  const makeDevice = (label: string): Device => ({
    input: { label: `${label}:in` } as unknown as AudioNode,
    output: { label: `${label}:out` } as unknown as AudioNode,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    setParam: vi.fn(),
    dispose: vi.fn(),
  })

  const returnTracks: FakeReturnTrack[] = []
  const instrumentTracks: FakeInstrumentTrack[] = []

  class FakeReturnTrack {
    readonly strip = {
      setLevel: vi.fn(),
      sends: { add: vi.fn() },
    }

    constructor(readonly options: TrackOptions) {
      returnTracks.push(this)
    }
  }

  class FakeInstrumentTrack {
    readonly device: Device
    readonly strip = {
      setLevel: vi.fn(),
      sends: { add: vi.fn() },
    }
    readonly noteOn = vi.fn()
    readonly noteOff = vi.fn()

    constructor(readonly options: TrackOptions) {
      this.device = options.device
      instrumentTracks.push(this)
    }
  }

  return {
    makeDevice,
    pianoDevice: undefined as unknown as Device,
    plateDevice: undefined as unknown as Device,
    createFeltPiano: vi.fn(),
    createPlateReverb: vi.fn(),
    ReturnTrack: FakeReturnTrack,
    InstrumentTrack: FakeInstrumentTrack,
    returnTracks,
    instrumentTracks,
  }
})

vi.mock('../../../vendor/engine/engine.js', () => ({
  createFeltPiano: engine.createFeltPiano,
  createPlateReverb: engine.createPlateReverb,
  ReturnTrack: engine.ReturnTrack,
  InstrumentTrack: engine.InstrumentTrack,
}))

import { makeKeys } from './keys'

describe('makeKeys', () => {
  const context = { currentTime: 0 } as unknown as BaseAudioContext
  const out = { id: 'out' } as unknown as AudioNode

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
    })
    engine.returnTracks.length = 0
    engine.instrumentTracks.length = 0
    engine.pianoDevice = engine.makeDevice('piano')
    engine.plateDevice = engine.makeDevice('plate')
    engine.createFeltPiano.mockReset().mockResolvedValue(engine.pianoDevice)
    engine.createPlateReverb.mockReset().mockResolvedValue(engine.plateDevice)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('wires felt piano and plate reverb through ReturnTrack, InstrumentTrack, and send level', async () => {
    await makeKeys(context, out)

    expect(engine.createFeltPiano).toHaveBeenCalledWith(context, { params: { reverbMix: 0.15 } })
    expect(engine.createPlateReverb).toHaveBeenCalledWith(context, {
      params: { mix: 1, decay: 0.8, damping: 0.4, predelayMs: 18 },
    })

    expect(engine.returnTracks).toHaveLength(1)
    expect(engine.returnTracks[0].options).toEqual({
      name: 'room',
      device: engine.plateDevice,
      destination: out,
      context,
    })

    expect(engine.instrumentTracks).toHaveLength(1)
    expect(engine.instrumentTracks[0].options).toEqual({
      name: 'piano',
      device: engine.pianoDevice,
      destination: out,
      context,
    })
    expect(engine.instrumentTracks[0].strip.sends.add).toHaveBeenCalledWith(engine.returnTracks[0], { level: 0.45 })
  })

  it('schedules delayed noteOn and noteOff for each strike with distinct ids', async () => {
    const keys = await makeKeys(context, out)
    const track = engine.instrumentTracks[0]

    keys.strike(440, 0.3, 0.25, 1.5)
    keys.strike(554.37, 0.2, 0.4, 0.5)

    expect(track.noteOn).not.toHaveBeenCalled()
    expect(track.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(249)
    expect(track.noteOn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(track.noteOn).toHaveBeenCalledTimes(1)
    expect(track.noteOn).toHaveBeenCalledWith(1, 440, 0.3)

    vi.advanceTimersByTime(150)
    expect(track.noteOn).toHaveBeenCalledTimes(2)
    expect(track.noteOn).toHaveBeenLastCalledWith(2, 554.37, 0.2)
    expect(track.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(499)
    expect(track.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(track.noteOff).toHaveBeenCalledTimes(1)
    expect(track.noteOff).toHaveBeenCalledWith(2)

    vi.advanceTimersByTime(849)
    expect(track.noteOff).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(track.noteOff).toHaveBeenCalledTimes(2)
    expect(track.noteOff).toHaveBeenLastCalledWith(1)
  })

  it('hush releases only currently held notes and clears them', async () => {
    const keys = await makeKeys(context, out)
    const track = engine.instrumentTracks[0]

    keys.strike(261.63, 0.2, 0.05, 0.1)
    keys.strike(329.63, 0.25, 0.1, 2)
    keys.strike(392, 0.3, 0.2, 2)
    keys.strike(523.25, 0.3, 1, 1)

    vi.advanceTimersByTime(500)
    expect(track.noteOff).toHaveBeenCalledTimes(1)
    expect(track.noteOff).toHaveBeenCalledWith(1)
    track.noteOff.mockClear()

    keys.hush()
    expect(track.noteOff).toHaveBeenCalledTimes(2)
    expect(track.noteOff.mock.calls.map(([id]) => id)).toEqual([2, 3])

    track.noteOff.mockClear()
    keys.hush()
    expect(track.noteOff).not.toHaveBeenCalled()
  })
})
