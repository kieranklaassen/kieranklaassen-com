import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Keys } from '../sound/keys'

type ParamCall =
  | { op: 'setValueAtTime'; value: number; time: number }
  | { op: 'linearRampToValueAtTime'; value: number; time: number }
  | { op: 'exponentialRampToValueAtTime'; value: number; time: number }
  | { op: 'setTargetAtTime'; target: number; startTime: number; timeConstant: number }

class FakeAudioParam {
  value: number
  readonly calls: ParamCall[] = []

  constructor(initial = 0) {
    this.value = initial
  }

  setValueAtTime(value: number, time: number) {
    this.calls.push({ op: 'setValueAtTime', value, time })
    return this
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ op: 'linearRampToValueAtTime', value, time })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push({ op: 'exponentialRampToValueAtTime', value, time })
    return this
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number) {
    this.calls.push({ op: 'setTargetAtTime', target, startTime, timeConstant })
    return this
  }
}

class FakeAudioNode {
  readonly connections: unknown[] = []
  readonly disconnect = vi.fn()

  connect<T>(destination: T): T {
    this.connections.push(destination)
    return destination
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1)
}

class FakeDynamicsCompressorNode extends FakeAudioNode {}

class FakeConvolverNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam(350)
}

class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam(0)
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam(440)
  startedAt?: number
  stoppedAt?: number

  start(when = 0) {
    this.startedAt = when
  }

  stop(when = 0) {
    this.stoppedAt = when
  }
}

class FakeAudioBuffer {
  private readonly channels: Float32Array[]

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  getChannelData(channel: number) {
    return this.channels[channel]
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 10
  readonly sampleRate = 100
  readonly destination = new FakeAudioNode()
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly gains: FakeGainNode[] = []
  readonly compressors: FakeDynamicsCompressorNode[] = []
  readonly convolvers: FakeConvolverNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly panners: FakeStereoPannerNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly buffers: FakeAudioBuffer[] = []

  createGain() {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node
  }

  createDynamicsCompressor() {
    const node = new FakeDynamicsCompressorNode()
    this.compressors.push(node)
    return node
  }

  createConvolver() {
    const node = new FakeConvolverNode()
    this.convolvers.push(node)
    return node
  }

  createBiquadFilter() {
    const node = new FakeBiquadFilterNode()
    this.filters.push(node)
    return node
  }

  createStereoPanner() {
    const node = new FakeStereoPannerNode()
    this.panners.push(node)
    return node
  }

  createOscillator() {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate)
    this.buffers.push(buffer)
    return buffer
  }
}

const mocks = vi.hoisted(() => ({
  theContext: vi.fn(),
  makeKeys: vi.fn(),
}))

vi.mock('../sound/context', () => ({
  theContext: mocks.theContext,
}))

vi.mock('../sound/keys', () => ({
  makeKeys: mocks.makeKeys,
}))

import { Instrument, distanceOf, pitchOf, voicesOf } from './player'

describe('the voices of a stroke', () => {
  it('mirrors about the middle of the staff', () => {
    for (let lane = 0; lane < 8; lane++) expect(distanceOf(7 - lane) + distanceOf(lane)).toBe(0)
  })

  it('finds the six voices in degrees', () => {
    expect(voicesOf(5)).toEqual([5, -5, 3, -3, -4, 0])
    expect(voicesOf(-5)).toEqual([-5, 5, -3, 3, 4, 0])
  })

  it('stays in the scale, about its second', () => {
    expect(pitchOf(62, 0)).toBe(62) // D in C major
    expect([1, 2, 3, 7].map((degrees) => pitchOf(62, degrees))).toEqual([64, 65, 67, 74])
    expect([-1, -2, -7].map((degrees) => pitchOf(62, degrees))).toEqual([60, 59, 50])
    const inC = new Set([0, 2, 4, 5, 7, 9, 11])
    for (let degrees = -14; degrees <= 14; degrees++) expect(inC.has(pitchOf(62, degrees) % 12)).toBe(true)
  })
})

describe('Instrument', () => {
  let ctx: FakeAudioContext
  let keys: { strike: ReturnType<typeof vi.fn<Keys['strike']>>; hush: ReturnType<typeof vi.fn<Keys['hush']>> }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      AudioContext: class {},
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
    })

    ctx = new FakeAudioContext()
    keys = {
      strike: vi.fn<Keys['strike']>(),
      hush: vi.fn<Keys['hush']>(),
    }
    mocks.theContext.mockReset().mockReturnValue(ctx)
    mocks.makeKeys.mockReset().mockResolvedValue(keys)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports whether Web Audio is available via Instrument.possible', () => {
    expect(Instrument.possible).toBe(true)
    vi.stubGlobal('window', {})
    expect(Instrument.possible).toBe(false)
  })

  it('wires dry and wet convolver paths into the compressor and reports score duration', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    const instrument = new Instrument()

    expect(instrument.lasts).toBe(28)
    expect(ctx.compressors).toHaveLength(1)
    expect(ctx.convolvers).toHaveLength(1)
    expect(ctx.gains).toHaveLength(2)

    const [level, wetLevel] = ctx.gains
    const [out] = ctx.compressors
    const [wet] = ctx.convolvers

    expect(level.gain.value).toBe(0.8)
    expect(wetLevel.gain.value).toBe(0.42)
    expect(level.connections).toContain(out)
    expect(out.connections).toContain(ctx.destination)
    expect(level.connections).toContain(wet)
    expect(wet.connections).toContain(wetLevel)
    expect(wetLevel.connections).toContain(out)

    expect(ctx.buffers).toHaveLength(1)
    expect(wet.buffer).toBe(ctx.buffers[0])
    expect(ctx.buffers[0].numberOfChannels).toBe(2)
    expect(ctx.buffers[0].length).toBe(340)
    expect(ctx.buffers[0].getChannelData(0)[0]).toBeCloseTo(0.5, 5)
    expect(ctx.buffers[0].getChannelData(0)[339]).toBeCloseTo(0, 4)
  })

  it('ready loads keys once, resumes a suspended context, and routes strikes through keys', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    ctx.state = 'suspended'
    const instrument = new Instrument()

    await instrument.ready()
    await instrument.ready()

    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(mocks.makeKeys).toHaveBeenCalledTimes(1)
    expect(mocks.makeKeys).toHaveBeenCalledWith(ctx, ctx.gains[0])

    instrument.strike({ lane: 1, year: 6, length: 120 }, 0.5, 0.12)

    expect(ctx.oscillators).toHaveLength(0)
    expect(keys.strike).toHaveBeenCalledTimes(6)

    const expectedVoices = voicesOf(distanceOf(1))
    const expectedShares = [1, 0.62, 0.42, 0.36, 0.26, 0.24]
    expectedVoices.forEach((degrees, i) => {
      const pitch = 440 * 2 ** ((pitchOf(67, degrees) - 69) / 12)
      const [calledPitch, calledGain, calledAfter, calledRings] = keys.strike.mock.calls[i]
      expect(calledPitch).toBeCloseTo(pitch, 5)
      expect(calledGain).toBeCloseTo(0.3 * expectedShares[i], 5)
      expect(calledAfter).toBeCloseTo(0.12 + i * 0.034, 5)
      expect(calledRings).toBeCloseTo(5.5, 5)
    })
  })

  it('falls back to paired oscillators when keys fail to load and resumes suspended context on strike', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const error = new Error('worklet unavailable')
    mocks.makeKeys.mockRejectedValueOnce(error)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const instrument = new Instrument()
    await instrument.ready()

    expect(warn).toHaveBeenCalledWith('The piano could not be had.', error)

    ctx.state = 'suspended'
    ctx.currentTime = 12
    instrument.strike({ lane: 2, year: 0, length: 20 }, 2, 0.1)

    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(ctx.oscillators).toHaveLength(12)
    expect(ctx.filters).toHaveLength(6)
    expect(ctx.panners).toHaveLength(6)

    const rings = 1.5 + 20 / 20
    const firstPitch = 440 * 2 ** ((pitchOf(62, voicesOf(distanceOf(2))[0]) - 69) / 12)
    const [tri, sine] = ctx.oscillators
    expect(tri.type).toBe('triangle')
    expect(tri.frequency.value).toBeCloseTo(firstPitch, 5)
    expect(tri.startedAt).toBeCloseTo(12.1, 5)
    expect(tri.stoppedAt).toBeCloseTo(12.1 + rings + 0.05, 5)

    expect(sine.type).toBe('sine')
    expect(sine.frequency.value).toBeCloseTo(firstPitch * 2.003, 5)
    expect(sine.startedAt).toBeCloseTo(12.1, 5)
    expect(sine.stoppedAt).toBeCloseTo(12.1 + rings + 0.05, 5)

    expect(ctx.filters[0].type).toBe('lowpass')
    expect(ctx.filters[0].frequency.calls).toEqual([
      { op: 'setValueAtTime', value: expect.closeTo(firstPitch * 5, 5), time: expect.closeTo(12.1, 5) },
      { op: 'exponentialRampToValueAtTime', value: expect.closeTo(firstPitch * 1.4, 5), time: expect.closeTo(12.1 + rings * 0.7, 5) },
    ])
    const voiceLevels = ctx.gains.filter((gain) => gain.gain.calls.length > 0)
    expect(voiceLevels).toHaveLength(6)
    expect(voiceLevels[0].gain.calls).toEqual([
      { op: 'setValueAtTime', value: 0, time: expect.closeTo(12.1, 5) },
      { op: 'linearRampToValueAtTime', value: expect.closeTo(0.16, 5), time: expect.closeTo(12.112, 5) },
      { op: 'exponentialRampToValueAtTime', value: 0.0004, time: expect.closeTo(12.1 + rings, 5) },
    ])
    expect(voiceLevels[1].gain.calls).toEqual([
      { op: 'setValueAtTime', value: 0, time: expect.closeTo(12.134, 5) },
      { op: 'linearRampToValueAtTime', value: expect.closeTo(0.16 * 0.62, 5), time: expect.closeTo(12.184, 5) },
      { op: 'exponentialRampToValueAtTime', value: 0.0004, time: expect.closeTo(12.134 + rings * 0.85, 5) },
    ])
    for (const panner of ctx.panners) {
      expect(panner.pan.value).toBe(1)
      expect(panner.connections).toContain(ctx.gains[0])
    }
  })

  it('play schedules strikes, heard callbacks, and final stop; stop cancels pending timers and calls ended once', async () => {
    const instrument = new Instrument()
    await instrument.ready()

    const heardFirst = vi.fn()
    const heardSecond = vi.fn()
    const ended = vi.fn()

    instrument.play(
      [
        { lane: 0, year: 0, length: 10, at: 0, heard: heardFirst },
        { lane: 3, year: 1, length: 10, at: 0.5, heard: heardSecond },
      ],
      ended,
    )

    expect(ctx.gains[0].gain.calls).toContainEqual({
      op: 'setTargetAtTime',
      target: 0.8,
      startTime: 10,
      timeConstant: 0.02,
    })

    vi.advanceTimersByTime(0)
    expect(keys.strike).toHaveBeenCalledTimes(6)
    expect(heardFirst).not.toHaveBeenCalled()

    vi.advanceTimersByTime(120)
    expect(heardFirst).toHaveBeenCalledTimes(1)
    expect(heardSecond).not.toHaveBeenCalled()

    vi.advanceTimersByTime(13759)
    expect(keys.strike).toHaveBeenCalledTimes(6)

    vi.advanceTimersByTime(1)
    expect(keys.strike).toHaveBeenCalledTimes(12)
    expect(heardSecond).not.toHaveBeenCalled()

    vi.advanceTimersByTime(120)
    expect(heardSecond).toHaveBeenCalledTimes(1)
    expect(ended).not.toHaveBeenCalled()

    vi.advanceTimersByTime(15000)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(keys.hush).toHaveBeenCalled()

    instrument.stop()
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('stop cancels in-flight playback timers and restarting play stops the previous run', async () => {
    const instrument = new Instrument()
    await instrument.ready()

    const firstHeard = vi.fn()
    const firstEnded = vi.fn()
    const secondHeard = vi.fn()
    const secondEnded = vi.fn()

    instrument.play([{ lane: 1, year: 0, length: 10, at: 0.5, heard: firstHeard }], firstEnded)
    instrument.play([{ lane: 2, year: 0, length: 10, at: 0.5, heard: secondHeard }], secondEnded)

    expect(firstEnded).toHaveBeenCalledTimes(1)
    expect(secondEnded).not.toHaveBeenCalled()
    expect(keys.hush).toHaveBeenCalled()

    instrument.stop()
    expect(secondEnded).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(30000)
    expect(keys.strike).not.toHaveBeenCalled()
    expect(firstHeard).not.toHaveBeenCalled()
    expect(secondHeard).not.toHaveBeenCalled()
    expect(firstEnded).toHaveBeenCalledTimes(1)
    expect(secondEnded).toHaveBeenCalledTimes(1)
  })

  it('close stops playback, fades level to zero, and disconnects output after 400ms', async () => {
    const instrument = new Instrument()
    await instrument.ready()

    const ended = vi.fn()
    instrument.play([{ lane: 0, year: 0, length: 10, at: 0.5, heard: vi.fn() }], ended)

    ctx.currentTime = 15
    instrument.close()

    expect(ended).toHaveBeenCalledTimes(1)
    expect(keys.hush).toHaveBeenCalled()
    expect(ctx.gains[0].gain.calls).toContainEqual({
      op: 'setTargetAtTime',
      target: 0,
      startTime: 15,
      timeConstant: 0.05,
    })

    vi.advanceTimersByTime(399)
    expect(ctx.compressors[0].disconnect).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(ctx.compressors[0].disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not start playback or strike notes after close', async () => {
    const instrument = new Instrument()
    await instrument.ready()

    instrument.close()
    keys.hush.mockClear()

    const heard = vi.fn()
    const ended = vi.fn()
    instrument.play([{ lane: 0, year: 0, length: 10, at: 0, heard }], ended)
    instrument.strike({ lane: 0, year: 0, length: 10 }, 0.5, 0)

    vi.advanceTimersByTime(30000)
    expect(keys.strike).not.toHaveBeenCalled()
    expect(heard).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
    expect(keys.hush).not.toHaveBeenCalled()
  })
})
