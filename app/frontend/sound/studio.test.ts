import { describe, expect, it, vi } from 'vitest'
import type { Band } from './band'
import type { Heard } from './ear'
import type { Place } from './place'
import { CENTERS, chordOf, degreeOf, noteOf } from './scale'
import { PARTS, Studio } from './studio'

type ParamCall =
  | { op: 'setValueAtTime'; value: number; time: number }
  | { op: 'linearRampToValueAtTime'; value: number; time: number }
  | { op: 'exponentialRampToValueAtTime'; value: number; time: number }
  | { op: 'setTargetAtTime'; target: number; startTime: number; timeConstant: number }
  | { op: 'cancelScheduledValues'; cancelTime: number }

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

  cancelScheduledValues(cancelTime: number) {
    this.calls.push({ op: 'cancelScheduledValues', cancelTime })
    return this
  }
}

class FakeAudioNode {
  readonly connections: unknown[] = []

  connect<T>(destination: T): T {
    this.connections.push(destination)
    return destination
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1)
}

class FakeDynamicsCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam(0)
  readonly ratio = new FakeAudioParam(1)
  readonly attack = new FakeAudioParam(0)
  readonly release = new FakeAudioParam(0)
}

class FakeConvolverNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null
}

class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam(0)
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam(350)
  readonly Q = new FakeAudioParam(1)
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

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null
  loop = false
  started?: { when: number; offset?: number }
  stoppedAt?: number

  start(when = 0, offset?: number) {
    this.started = { when, offset }
  }

  stop(when = 0) {
    this.stoppedAt = when
  }
}

class FakeAudioBuffer {
  readonly duration: number
  private readonly channels: Float32Array[]

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  getChannelData(channel: number) {
    return this.channels[channel]
  }
}

class FakeAudioContext {
  currentTime = 10
  readonly sampleRate = 100
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly compressors: FakeDynamicsCompressorNode[] = []
  readonly convolvers: FakeConvolverNode[] = []
  readonly panners: FakeStereoPannerNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
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

  createStereoPanner() {
    const node = new FakeStereoPannerNode()
    this.panners.push(node)
    return node
  }

  createBiquadFilter() {
    const node = new FakeBiquadFilterNode()
    this.filters.push(node)
    return node
  }

  createOscillator() {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode()
    this.sources.push(node)
    return node
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate)
    this.buffers.push(buffer)
    return buffer
  }
}

function makeStudio(random: () => number = () => 0.5) {
  const ctx = new FakeAudioContext()
  const studio = new Studio(ctx as unknown as BaseAudioContext, random)
  const out = ctx.gains[0]
  const air = ctx.gains[2]
  const music = studio.inputs.music as unknown as FakeGainNode
  const weather = studio.inputs.weather as unknown as FakeGainNode
  const paint = ctx.gains[5]
  return { ctx, studio, out, air, music, weather, paint }
}

function makeBand() {
  return {
    moveTo: vi.fn(),
    touch: vi.fn(),
    letter: vi.fn(),
  } as unknown as Band & {
    moveTo: ReturnType<typeof vi.fn>
    touch: ReturnType<typeof vi.fn>
    letter: ReturnType<typeof vi.fn>
  }
}

function heard(overrides: Partial<Heard> = {}): Heard {
  return {
    gesture: 'square',
    pan: 0,
    size: 0.2,
    light: 0.5,
    warmth: 0.5,
    lasts: 0.8,
    ...overrides,
  }
}

function lastTargetCall(node: FakeGainNode) {
  return [...node.gain.calls].reverse().find((call) => call.op === 'setTargetAtTime')
}

describe('Studio', () => {
  it('exports the three controllable parts and builds the routing graph cleanly', () => {
    expect(PARTS).toEqual(['music', 'weather', 'paint'])

    const { ctx, studio, out, air, music, weather, paint } = makeStudio()
    expect(studio.sounding).toBe(false)
    expect(ctx.compressors).toHaveLength(1)
    expect(ctx.compressors[0].connections).toContain(ctx.destination)
    expect(out.connections).toContain(ctx.compressors[0])
    expect(air.connections).toContain(out)
    expect(music.connections).toContain(air)
    expect(weather.connections).toContain(air)
    expect(paint.connections).toContain(out)
    expect(paint.connections).not.toContain(air)

    expect(ctx.buffers.map((b) => [b.numberOfChannels, b.duration])).toEqual([
      [1, 2],
      [1, 5],
      [2, 3.2],
    ])

    out.gain.value = 0.5
    expect(studio.sounding).toBe(true)
  })

  it('fade cancels prior ramps and uses fast, slow, and fade-out time constants', () => {
    const { ctx, studio, out } = makeStudio()
    ctx.currentTime = 4.5

    studio.fade(true)
    expect(out.gain.calls).toEqual([
      { op: 'cancelScheduledValues', cancelTime: 4.5 },
      { op: 'setTargetAtTime', target: 0.8, startTime: 4.5, timeConstant: 0.5 },
    ])

    out.gain.calls.length = 0
    studio.fade(true, true, 6)
    expect(out.gain.calls).toEqual([
      { op: 'cancelScheduledValues', cancelTime: 6 },
      { op: 'setTargetAtTime', target: 0.8, startTime: 6, timeConstant: 1.6 },
    ])

    out.gain.calls.length = 0
    studio.fade(false, true, 8)
    expect(out.gain.calls).toEqual([
      { op: 'cancelScheduledValues', cancelTime: 8 },
      { op: 'setTargetAtTime', target: 0, startTime: 8, timeConstant: 0.12 },
    ])
  })

  it('hush ducks air (music and weather) while leaving paint unaffected', () => {
    const { ctx, studio, air, music, weather, paint } = makeStudio()
    ctx.currentTime = 12

    studio.hush(true)
    expect(lastTargetCall(air)).toEqual({ op: 'setTargetAtTime', target: 0.12, startTime: 12, timeConstant: 0.3 })
    expect(paint.gain.calls).toEqual([])
    expect(music.gain.calls).toEqual([])
    expect(weather.gain.calls).toEqual([])

    studio.hush(false, 15)
    expect(lastTargetCall(air)).toEqual({ op: 'setTargetAtTime', target: 1, startTime: 15, timeConstant: 1.2 })
    expect(paint.gain.calls).toEqual([])
  })

  it('turn toggles music, weather, and paint independently', () => {
    const { studio, music, weather, paint } = makeStudio()

    studio.turn('music', false, 2)
    expect(lastTargetCall(music)).toEqual({ op: 'setTargetAtTime', target: 0, startTime: 2, timeConstant: 0.1 })
    expect(weather.gain.calls).toEqual([])
    expect(paint.gain.calls).toEqual([])

    studio.turn('weather', false, 3)
    expect(lastTargetCall(weather)).toEqual({ op: 'setTargetAtTime', target: 0, startTime: 3, timeConstant: 0.1 })

    studio.turn('paint', false, 4)
    expect(lastTargetCall(paint)).toEqual({ op: 'setTargetAtTime', target: 0, startTime: 4, timeConstant: 0.1 })

    studio.turn('music', true, 5)
    studio.turn('weather', true, 6)
    studio.turn('paint', true, 7)
    expect(lastTargetCall(music)).toEqual({ op: 'setTargetAtTime', target: 1, startTime: 5, timeConstant: 0.3 })
    expect(lastTargetCall(weather)).toEqual({ op: 'setTargetAtTime', target: 1, startTime: 6, timeConstant: 0.3 })
    expect(lastTargetCall(paint)).toEqual({ op: 'setTargetAtTime', target: 1, startTime: 7, timeConstant: 0.3 })
  })

  it('moveTo forwards to band when present and updates local key, sky, and drone timing', () => {
    const { ctx, studio } = makeStudio(() => 0.5)
    const band = makeBand()
    studio.band = band

    const place: Place = { key: 2, sky: 'rain', near: 0.9, voice: 'pan' }
    studio.moveTo(place)
    expect(band.moveTo).toHaveBeenCalledWith(place)

    studio.band = undefined
    ctx.currentTime = 20
    studio.ahead(24)
    const droneOscillators = ctx.oscillators.filter((o) => o.type === 'sine' && o.startedAt === 20.3)
    expect(droneOscillators).toHaveLength(12)
    const expectedPitches = chordOf(CENTERS[2] - 12, 3)
    const scheduledStarts = droneOscillators.map((o) => {
      const first = o.frequency.calls[0]
      return first?.op === 'setValueAtTime' ? first.value : 0
    })
    for (const pitch of expectedPitches) {
      expect(scheduledStarts.some((f) => Math.abs(f - pitch) / pitch < 0.005)).toBe(true)
    }

    // With sky !== 'sea', wave omits the highpass foam layer; switching to sea with near > 0.2 adds it.
    expect(ctx.filters.some((f) => f.type === 'highpass')).toBe(false)

    ctx.currentTime = 21
    studio.moveTo({ key: 4, sky: 'sea', near: 0.8, voice: 'piano' })
    const beforeCount = ctx.oscillators.length
    studio.ahead(22)
    const newDrones = ctx.oscillators.slice(beforeCount).filter((o) => o.type === 'sine' && o.startedAt === 21.6)
    expect(newDrones).toHaveLength(12)

    ctx.currentTime = 30
    studio.ahead(32)
    expect(ctx.filters.some((f) => f.type === 'highpass')).toBe(true)
  })

  describe('hears gesture dispatch and rate limiting', () => {
    it('dispatches square, letter, puddle, bank, run, flood, drop, rain, and splash without band', () => {
      const { ctx, studio, music } = makeStudio(() => 0.1)
      const [whiteBuffer, pinkBuffer] = ctx.buffers

      // square with random < 0.3 adds a brush (2 sources, triangle bite) + 1 bubble oscillator
      studio.hears(heard({ gesture: 'square', pan: 2 }), 1)
      expect(ctx.sources).toHaveLength(2)
      expect(ctx.sources.map((s) => s.buffer)).toEqual([whiteBuffer, pinkBuffer])
      expect(ctx.oscillators).toHaveLength(2)
      expect(ctx.panners[0].pan.value).toBe(1)

      // square with random >= 0.3 skips the extra bubble
      const quiet = makeStudio(() => 0.9)
      quiet.studio.hears(heard({ gesture: 'square', pan: -2 }), 1)
      expect(quiet.ctx.oscillators).toHaveLength(1)
      expect(quiet.ctx.panners[0].pan.value).toBe(-1)

      // letter without band creates a brush + a tuned sing
      const beforeLetterOsc = ctx.oscillators.length
      const beforeLetterSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'letter', index: 5 }), 2)
      expect(ctx.sources.length - beforeLetterSrc).toBe(3)
      expect(ctx.oscillators.length - beforeLetterOsc).toBe(2)
      const letterSing = ctx.oscillators[ctx.oscillators.length - 1]
      expect(letterSing.frequency.value).toBeCloseTo(noteOf(CENTERS[0], (5 % 12) - 4) * 2, 4)

      // puddle creates 1 bubble + 1 short brush
      const beforePuddleOsc = ctx.oscillators.length
      const beforePuddleSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'puddle' }), 3)
      expect(ctx.oscillators.length - beforePuddleOsc).toBe(2)
      expect(ctx.sources.length - beforePuddleSrc).toBe(2)

      // bank creates a wide brush only
      const beforeBankOsc = ctx.oscillators.length
      const beforeBankSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'bank' }), 4)
      expect(ctx.oscillators.length - beforeBankOsc).toBe(1)
      expect(ctx.sources.length - beforeBankSrc).toBe(2)

      // flood creates a brush + sing at the page pitch
      const beforeFloodOsc = ctx.oscillators.length
      const beforeFloodSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'flood', light: 0.5, warmth: 0.5 }), 5)
      expect(ctx.oscillators.length - beforeFloodOsc).toBe(2)
      expect(ctx.sources.length - beforeFloodSrc).toBe(3)
      expect(ctx.oscillators[ctx.oscillators.length - 1].frequency.value).toBeCloseTo(noteOf(CENTERS[0], degreeOf(0.5, 0.5)), 4)

      // run creates descending bubble oscillators and no noise sources
      const beforeRunOsc = ctx.oscillators.length
      const beforeRunSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'run', lasts: 1 }), 6)
      expect(ctx.sources.length - beforeRunSrc).toBe(0)
      const runBubbles = ctx.oscillators.slice(beforeRunOsc)
      expect(runBubbles).toHaveLength(Math.round(3 + 1 * 3.5))
      const firstFreq = runBubbles[0].frequency.calls[0]
      const lastFreq = runBubbles[runBubbles.length - 1].frequency.calls[0]
      expect(firstFreq?.op === 'setValueAtTime' && lastFreq?.op === 'setValueAtTime' && firstFreq.value > lastFreq.value).toBe(true)

      // drop creates bubble + sing
      const beforeDropOsc = ctx.oscillators.length
      const beforeDropSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'drop' }), 7)
      expect(ctx.oscillators.length - beforeDropOsc).toBe(2)
      expect(ctx.sources.length - beforeDropSrc).toBe(1)

      // rain without band routes sing into parts.music
      const beforeRainPan = ctx.panners.length
      studio.hears(heard({ gesture: 'rain' }), 8)
      expect(ctx.panners[beforeRainPan].connections).toContain(music)

      // splash creates thud + slap + spray bubbles + sing
      const beforeSplashOsc = ctx.oscillators.length
      const beforeSplashSrc = ctx.sources.length
      studio.hears(heard({ gesture: 'splash', size: 0.5 }), 9)
      const expectedDrops = Math.round(7 + 9 * 0.5)
      expect(ctx.oscillators.length - beforeSplashOsc).toBe(1 + expectedDrops + 1)
      expect(ctx.sources.length - beforeSplashSrc).toBe(2)
    })

    it('forwards letter, drop, rain, and splash gestures to band when attached', () => {
      const { ctx, studio } = makeStudio(() => 0.5)
      const band = makeBand()
      studio.band = band

      const degree = degreeOf(0.6, 0.4)

      // letter calls band.letter(index) and skips the local sing
      studio.hears(heard({ gesture: 'letter', index: 4 }), 1)
      expect(band.letter).toHaveBeenCalledWith(4)
      expect(ctx.sources).toHaveLength(2) // brush only, no sing pink source

      // rain delegates entirely to band.touch without creating local audio nodes
      const beforeRainSources = ctx.sources.length
      const beforeRainOsc = ctx.oscillators.length
      studio.hears(heard({ gesture: 'rain', light: 0.6, warmth: 0.4 }), 2)
      expect(band.touch).toHaveBeenCalledWith(degree, 0.13)
      expect(ctx.sources).toHaveLength(beforeRainSources)
      expect(ctx.oscillators).toHaveLength(beforeRainOsc)

      // drop calls band.touch and softens the local sing peak to 0.05
      const beforeDropGains = ctx.gains.length
      studio.hears(heard({ gesture: 'drop', light: 0.6, warmth: 0.4 }), 3)
      expect(band.touch).toHaveBeenCalledWith(degree, 0.2)
      const dropPeaks = ctx.gains
        .slice(beforeDropGains)
        .flatMap((g) => g.gain.calls)
        .filter((c): c is Extract<ParamCall, { op: 'linearRampToValueAtTime' }> => c.op === 'linearRampToValueAtTime')
        .map((c) => c.value)
      expect(dropPeaks).toContain(0.05)

      // splash calls band.touch(degree - 7, 0.3)
      studio.hears(heard({ gesture: 'splash', light: 0.6, warmth: 0.4 }), 4)
      expect(band.touch).toHaveBeenCalledWith(degree - 7, 0.3)
    })

    it('enforces the MOST = 5 strokes-per-100ms rate limit with headroom for large strokes and bypass for drops/rain/splash', () => {
      const { ctx, studio } = makeStudio(() => 0.5)

      // 5 small strokes in the same 100ms window all play
      for (let i = 0; i < 5; i++) studio.hears(heard({ gesture: 'bank', size: 0.2 }), 1 + i * 0.01)
      expect(ctx.sources).toHaveLength(10)

      // 6th small stroke within 100ms is dropped
      studio.hears(heard({ gesture: 'bank', size: 0.2 }), 1.05)
      expect(ctx.sources).toHaveLength(10)

      // Large strokes (size > 0.3) get MOST + 2 = 7 slots total
      studio.hears(heard({ gesture: 'bank', size: 0.5 }), 1.06)
      studio.hears(heard({ gesture: 'bank', size: 0.5 }), 1.07)
      expect(ctx.sources).toHaveLength(14)

      // 8th stroke (even large) is dropped
      studio.hears(heard({ gesture: 'bank', size: 0.8 }), 1.08)
      expect(ctx.sources).toHaveLength(14)

      // Ungated gestures still play while the window is saturated
      studio.hears(heard({ gesture: 'drop' }), 1.08)
      expect(ctx.sources).toHaveLength(15)

      // Once 100ms elapses, the rate-limit window clears and small strokes play again
      studio.hears(heard({ gesture: 'bank', size: 0.2 }), 1.2)
      expect(ctx.sources).toHaveLength(17)
    })
  })

  describe('ahead scheduling', () => {
    it('schedules fallback drones, waves, and rain when band is absent without duplicating for the same horizon', () => {
      const { ctx, studio, weather } = makeStudio(() => 0.5)
      ctx.currentTime = 10
      const rain = vi.fn()

      studio.ahead(13, rain)
      const firstOscCount = ctx.oscillators.length
      const firstSrcCount = ctx.sources.length
      expect(firstOscCount).toBe(12)
      expect(firstSrcCount).toBeGreaterThanOrEqual(1)
      expect(ctx.panners.some((p) => p.connections.includes(weather))).toBe(true)
      expect(rain).toHaveBeenCalledTimes(1)
      expect(rain).toHaveBeenCalledWith(11.4)

      // Calling again for the same horizon schedules nothing new
      studio.ahead(13, rain)
      expect(ctx.oscillators).toHaveLength(firstOscCount)
      expect(ctx.sources).toHaveLength(firstSrcCount)
      expect(rain).toHaveBeenCalledTimes(1)

      // Without a rain callback, ahead synthesizes fallback rain into parts.music
      const fallback = makeStudio(() => 0.5)
      fallback.ctx.currentTime = 10
      fallback.studio.ahead(12)
      expect(fallback.ctx.panners.some((p) => p.connections.includes(fallback.music))).toBe(true)
    })

    it('skips fallback drones and waves when band is attached and paces the rain callback', () => {
      const { ctx, studio } = makeStudio(() => 0.5)
      studio.band = makeBand()
      const rain = vi.fn()

      ctx.currentTime = 10
      studio.ahead(20, rain)
      expect(ctx.oscillators).toHaveLength(0)
      expect(ctx.sources).toHaveLength(0)
      expect(rain).toHaveBeenCalledTimes(1)
      expect(rain).toHaveBeenCalledWith(10)

      // Before nextRain (~10 + 1.2 + 3.4 * 0.5^1.5 ≈ 12.40), rain does not fire again
      ctx.currentTime = 11
      studio.ahead(20, rain)
      expect(rain).toHaveBeenCalledTimes(1)

      // After advancing past nextRain, rain fires once more
      ctx.currentTime = 15
      studio.ahead(25, rain)
      expect(rain).toHaveBeenCalledTimes(2)
      expect(rain).toHaveBeenLastCalledWith(15)
      expect(ctx.oscillators).toHaveLength(0)
      expect(ctx.sources).toHaveLength(0)
    })
  })
})
