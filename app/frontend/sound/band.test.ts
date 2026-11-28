import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '../../../vendor/engine/engine.js'
import { pitchOf } from '../looks/player'
import type { Place } from './place'
import { CENTERS, hertz, noteOf } from './scale'

interface TrackOptions {
  name: string
  device: Device
  destination: AudioNode
  context: BaseAudioContext
}

type TargetCall = { target: number; startTime: number; timeConstant: number }

class FakeGainParam {
  value = 1
  readonly targetCalls: TargetCall[] = []

  setTargetAtTime(target: number, startTime: number, timeConstant: number) {
    this.targetCalls.push({ target, startTime, timeConstant })
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
  readonly gain = new FakeGainParam()
}

class FakeAudioContext {
  currentTime = 10
  readonly gains: FakeGainNode[] = []

  createGain() {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node
  }
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
    thesisDevice: undefined as unknown as Device,
    skyDevice: undefined as unknown as Device,
    reverbDevice: undefined as unknown as Device,
    pianoDevice: undefined as unknown as Device,
    handpanDevice: undefined as unknown as Device,
    dropletsDevice: undefined as unknown as Device,
    createThesis: vi.fn(),
    createAtmosphere: vi.fn(),
    createPlateReverb: vi.fn(),
    createFeltPiano: vi.fn(),
    createHandpan: vi.fn(),
    createDroplets: vi.fn(),
    ReturnTrack: FakeReturnTrack,
    InstrumentTrack: FakeInstrumentTrack,
    returnTracks,
    instrumentTracks,
  }
})

vi.mock('../../../vendor/engine/engine.js', () => ({
  createThesis: engine.createThesis,
  createAtmosphere: engine.createAtmosphere,
  createPlateReverb: engine.createPlateReverb,
  createFeltPiano: engine.createFeltPiano,
  createHandpan: engine.createHandpan,
  createDroplets: engine.createDroplets,
  ReturnTrack: engine.ReturnTrack,
  InstrumentTrack: engine.InstrumentTrack,
}))

import { Band } from './band'

function trackNamed(name: string) {
  const track = engine.instrumentTracks.find((entry) => entry.options.name === name)
  if (!track) throw new Error(`Missing InstrumentTrack ${name}`)
  return track
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function makeBandSetup(place: Place = { key: 0, sky: 'sea', near: 0.6, voice: 'piano' }) {
  const ctx = new FakeAudioContext()
  const out = {
    music: new FakeAudioNode() as unknown as AudioNode,
    weather: new FakeAudioNode() as unknown as AudioNode,
  }
  return {
    ctx,
    out,
    make: () => Band.make(ctx as unknown as BaseAudioContext, out, place),
  }
}

describe('Band', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
    })

    engine.returnTracks.length = 0
    engine.instrumentTracks.length = 0
    engine.thesisDevice = engine.makeDevice('thesis')
    engine.skyDevice = engine.makeDevice('sky')
    engine.reverbDevice = engine.makeDevice('reverb')
    engine.pianoDevice = engine.makeDevice('piano')
    engine.handpanDevice = engine.makeDevice('handpan')
    engine.dropletsDevice = engine.makeDevice('droplets')

    engine.createThesis.mockReset().mockResolvedValue(engine.thesisDevice)
    engine.createAtmosphere.mockReset().mockResolvedValue(engine.skyDevice)
    engine.createPlateReverb.mockReset().mockResolvedValue(engine.reverbDevice)
    engine.createFeltPiano.mockReset().mockResolvedValue(engine.pianoDevice)
    engine.createHandpan.mockReset().mockResolvedValue(engine.handpanDevice)
    engine.createDroplets.mockReset().mockResolvedValue(engine.dropletsDevice)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('Band.make connects buses, configures thesis key/root, starts sky, and lazily loads the initial voice', async () => {
    const place: Place = { key: 7, sky: 'rain', near: 0.75, voice: 'glass' }
    const { ctx, out, make } = makeBandSetup(place)

    const band = await make()
    await flushMicrotasks()

    const musicGain = band.music as unknown as FakeGainNode
    const weatherGain = band.weather as unknown as FakeGainNode
    expect(musicGain.connections).toContain(out.music)
    expect(weatherGain.connections).toContain(out.weather)
    expect(weatherGain.gain.value).toBe(0.75)

    const expectedCenter = CENTERS[7 % CENTERS.length]
    const expectedRoot = (expectedCenter - 2 + 120) % 12
    expect(engine.createThesis).toHaveBeenCalledWith(ctx, {
      params: {
        center: expectedCenter,
        root: expectedRoot,
        attack: 2.6,
        release: 5,
        resonance: 62,
        width: 92,
        mode: 1,
        breatheRate: 0.16,
        strum: 30,
        mirrorEnabled: 1,
        octaflipEnabled: 1,
        middleEnabled: 1,
        mirrorMiddleEnabled: 0,
        centerEnabled: 1,
        scale: 0,
      },
    })
    expect(engine.createAtmosphere).toHaveBeenCalledWith(ctx, {
      params: { type: 1, density: 0.4, movement: 0.4, tone: 0.5, resonance: 0, size: 0.3, attack: 4, release: 6, volume: -8 },
    })
    expect(engine.createPlateReverb).toHaveBeenCalledWith(ctx, {
      params: { mix: 1, decay: 0.82, damping: 0.45, predelayMs: 24 },
    })

    expect(engine.returnTracks).toHaveLength(1)
    expect(engine.returnTracks[0].options).toEqual({
      name: 'room',
      device: engine.reverbDevice,
      destination: band.music,
      context: ctx,
    })

    const thesis = trackNamed('thesis')
    expect(thesis.options.destination).toBe(band.music)
    expect(thesis.strip.setLevel).toHaveBeenCalledWith(0.5)
    expect(thesis.strip.sends.add).toHaveBeenCalledWith(engine.returnTracks[0], { level: 0.4 })

    const sky = trackNamed('sky')
    expect(sky.options.destination).toBe(band.weather)
    expect(sky.noteOn).toHaveBeenCalledWith(1, hertz(48), 0.8)

    expect(engine.createDroplets).toHaveBeenCalledWith(ctx, {
      params: { rain: 0.4, material: 0, loose: 1, size: 0.5, spread: 0, ring: 1.6, soft: 0.3, trail: 0 },
    })
    const glass = trackNamed('glass')
    expect(glass.strip.setLevel).toHaveBeenCalledWith(0.55)
    expect(glass.strip.sends.add).toHaveBeenCalledWith(engine.returnTracks[0], { level: 0.5 })
  })

  it.each<[number, number, number]>([
    [0, 62, 0],
    [1, 67, 5],
    [2, 60, 10],
    [3, 65, 3],
    [4, 58, 8],
  ])('computes thesis center and root for key=%i', async (key, center, root) => {
    const { make } = makeBandSetup({ key, sky: 'sea', near: 0.5, voice: 'piano' })
    await make()

    const params = engine.createThesis.mock.calls[0][1].params
    expect(params.center).toBe(center)
    expect(params.root).toBe(root)
  })

  describe('moveTo', () => {
    it('updates chord key, ramps weather gain, lazily loads voices once, and skips sky swap when sky is unchanged', async () => {
      const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.4, voice: 'piano' })
      const band = await make()
      await flushMicrotasks()

      const thesis = trackNamed('thesis')
      const sky = trackNamed('sky')
      const weatherGain = band.weather as unknown as FakeGainNode
      sky.noteOn.mockClear()

      ctx.currentTime = 14
      band.moveTo({ key: 3, sky: 'sea', near: 0.85, voice: 'pan' })
      band.moveTo({ key: 3, sky: 'sea', near: 0.85, voice: 'pan' })
      await flushMicrotasks()

      expect(thesis.device.setParam).toHaveBeenCalledWith('center', 65)
      expect(thesis.device.setParam).toHaveBeenCalledWith('root', 3)
      expect(weatherGain.gain.targetCalls).toContainEqual({ target: 0.85, startTime: 14, timeConstant: 1.5 })
      expect(engine.createHandpan).toHaveBeenCalledTimes(1)
      expect(engine.createHandpan).toHaveBeenCalledWith(ctx, {
        params: { decay: 6, touch: 0.2, shimmer: 0.7, sympathy: 0.8 },
      })
      expect(trackNamed('pan').strip.setLevel).toHaveBeenCalledWith(0.5)

      expect(sky.noteOff).not.toHaveBeenCalled()
      vi.advanceTimersByTime(5000)
      expect(sky.noteOn).not.toHaveBeenCalled()
    })

    it('releases the old sky immediately and applies the new sky params after 2500ms', async () => {
      const { make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      const band = await make()
      const sky = trackNamed('sky')
      sky.noteOn.mockClear()

      band.moveTo({ key: 1, sky: 'fire', near: 0.9, voice: 'piano' })
      expect(sky.noteOff).toHaveBeenCalledWith(1)
      expect(sky.device.setParam).not.toHaveBeenCalled()

      vi.advanceTimersByTime(2499)
      expect(sky.noteOn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(sky.device.setParam).toHaveBeenCalledWith('type', 3)
      expect(sky.device.setParam).toHaveBeenCalledWith('density', 0.4)
      expect(sky.device.setParam).toHaveBeenCalledWith('tone', 0.45)
      expect(sky.device.setParam).toHaveBeenCalledWith('volume', -13)
      expect(sky.noteOn).toHaveBeenCalledWith(1, hertz(48), 0.8)
    })

    it('shortens the chord cooldown to at most 0.8s after moving to a new place', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      const band = await make()
      const thesis = trackNamed('thesis')

      ctx.currentTime = 10
      band.ahead({ light: 0.6, warmth: 0.5 })
      expect(thesis.noteOn).toHaveBeenCalledTimes(1)

      ctx.currentTime = 11
      band.moveTo({ key: 2, sky: 'sea', near: 0.5, voice: 'piano' })

      ctx.currentTime = 11.7
      band.ahead({ light: 0.6, warmth: 0.5 })
      expect(thesis.noteOn).toHaveBeenCalledTimes(1)

      ctx.currentTime = 11.8
      band.ahead({ light: 0.6, warmth: 0.5 })
      expect(thesis.noteOn).toHaveBeenCalledTimes(2)
    })
  })

  it('stir adjusts sky tone and density from the active sky base and clamps at 1', async () => {
    const { make } = makeBandSetup({ key: 0, sky: 'wind', near: 0.5, voice: 'piano' })
    const band = await make()
    const sky = trackNamed('sky')

    band.stir(0.5)
    expect(sky.device.setParam).toHaveBeenCalledWith('tone', 0.42 + 0.3 * 0.5)
    expect(sky.device.setParam).toHaveBeenCalledWith('density', 0.36 + 0.35 * 0.5)

    vi.mocked(sky.device.setParam).mockClear()
    band.stir(3)
    expect(sky.device.setParam).toHaveBeenCalledWith('tone', 1)
    expect(sky.device.setParam).toHaveBeenCalledWith('density', 1)

    band.moveTo({ key: 0, sky: 'dust', near: 0.5, voice: 'piano' })
    vi.mocked(sky.device.setParam).mockClear()
    band.stir(0)
    expect(sky.device.setParam).toHaveBeenCalledWith('tone', 0.42)
    expect(sky.device.setParam).toHaveBeenCalledWith('density', 0.3)
  })

  it('ready resolves the piano voice once and shares the same track across calls', async () => {
    const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'pan' })
    const band = await make()

    const first = await band.ready()
    const second = await band.ready()

    expect(first).toBe(second)
    expect(first).toBe(trackNamed('piano'))
    expect(engine.createFeltPiano).toHaveBeenCalledTimes(1)
    expect(engine.createFeltPiano).toHaveBeenCalledWith(ctx, { params: { reverbMix: 0.2 } })
    expect(trackNamed('piano').strip.setLevel).toHaveBeenCalledWith(0.5)
    expect(trackNamed('piano').strip.sends.add).toHaveBeenCalledWith(engine.returnTracks[0], { level: 0.5 })
  })

  it('pluck is a no-op until the target voice has loaded, then sends noteOn and schedules noteOff', async () => {
    let resolvePiano!: (device: Device) => void
    engine.createFeltPiano.mockImplementation(
      () =>
        new Promise<Device>((resolve) => {
          resolvePiano = resolve
        }),
    )

    const { make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
    const band = await make()

    band.pluck(440, 0.3, 1.5)
    expect(engine.instrumentTracks.find((t) => t.options.name === 'piano')).toBeUndefined()

    resolvePiano(engine.pianoDevice)
    await band.ready()

    const piano = trackNamed('piano')
    band.pluck(440, 0.3, 1.5)
    expect(piano.noteOn).toHaveBeenCalledWith(100, 440, 0.3)
    expect(piano.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1499)
    expect(piano.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(piano.noteOff).toHaveBeenCalledWith(100)

    band.pluck(520, 0.2, 0.5, 'pan')
    expect(engine.instrumentTracks.find((t) => t.options.name === 'pan')).toBeUndefined()

    band.moveTo({ key: 0, sky: 'sea', near: 0.5, voice: 'pan' })
    await flushMicrotasks()
    band.pluck(330, 0.25, 0.4, 'piano')
    expect(piano.noteOn).toHaveBeenLastCalledWith(101, 330, 0.25)
    expect(trackNamed('pan').noteOn).not.toHaveBeenCalled()
  })

  it('letter and touch pluck scaled notes with expected pitches, gains, and release times', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { make } = makeBandSetup({ key: 1, sky: 'sea', near: 0.5, voice: 'piano' })
    const band = await make()
    await band.ready()
    const piano = trackNamed('piano')
    const center = CENTERS[1]

    band.letter(0)
    band.letter(1)
    band.letter(12, 0.4)
    band.touch(3, 0.25)

    expect(piano.noteOn).toHaveBeenNthCalledWith(1, 100, noteOf(center, -3), 0.26)
    expect(piano.noteOn).toHaveBeenNthCalledWith(2, 101, noteOf(center, -1), 0.26)
    expect(piano.noteOn).toHaveBeenNthCalledWith(3, 102, noteOf(center, -3), 0.4)
    expect(piano.noteOn).toHaveBeenNthCalledWith(4, 103, noteOf(center, 3) * 2, 0.25)

    vi.advanceTimersByTime(1199)
    expect(piano.noteOff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(piano.noteOff).toHaveBeenCalledTimes(1)
    expect(piano.noteOff).toHaveBeenCalledWith(103)

    vi.advanceTimersByTime(200)
    expect(piano.noteOff).toHaveBeenCalledTimes(4)
    expect(piano.noteOff).toHaveBeenNthCalledWith(2, 100)
    expect(piano.noteOff).toHaveBeenNthCalledWith(3, 101)
    expect(piano.noteOff).toHaveBeenNthCalledWith(4, 102)
  })

  describe('ahead and rest', () => {
    it('plays chords on cooldown, falls back to degree 2 when computed degree is 0, and releases expired held notes', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      const band = await make()
      const thesis = trackNamed('thesis')
      const chord = vi.fn()

      ctx.currentTime = 10
      band.ahead({ light: 0.5, warmth: 0.5 }, chord)
      expect(thesis.device.setParam).toHaveBeenCalledWith('resonance', 48 + 30 * 0.5)
      expect(thesis.noteOn).toHaveBeenCalledWith(100, hertz(pitchOf(CENTERS[0], 2)), 0.4)
      expect(chord).toHaveBeenCalledWith(0)

      ctx.currentTime = 15.5
      band.ahead(undefined, chord)
      expect(thesis.noteOff).toHaveBeenCalledTimes(1)
      expect(thesis.noteOff).toHaveBeenCalledWith(100)
      expect(thesis.noteOn).toHaveBeenCalledTimes(1)
      expect(chord).toHaveBeenCalledTimes(1)

      ctx.currentTime = 18.24
      band.ahead(undefined, chord)
      expect(thesis.noteOn).toHaveBeenCalledTimes(1)
      expect(thesis.noteOff).toHaveBeenCalledTimes(1)

      ctx.currentTime = 18.25
      band.ahead(undefined, chord)
      expect(thesis.device.setParam).toHaveBeenLastCalledWith('resonance', 48 + 30 * 0.6)
      expect(thesis.noteOn).toHaveBeenLastCalledWith(101, hertz(pitchOf(CENTERS[0], 4)), 0.4)
      expect(chord).toHaveBeenLastCalledWith(4)
    })

    it('evicts the oldest held note when more than KEPT (3) chords overlap', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      const band = await make()
      const thesis = trackNamed('thesis')

      for (let i = 0; i < 4; i++) {
        ctx.currentTime = 10 + i
        band.ahead({ light: 0.6, warmth: 0.5 })
        if (i < 3) band.moveTo({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      }

      expect(thesis.noteOn).toHaveBeenCalledTimes(4)
      expect(thesis.noteOff).toHaveBeenCalledTimes(1)
      expect(thesis.noteOff).toHaveBeenCalledWith(100)
    })

    it('rest releases all held notes and resets the chord cooldown', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { ctx, make } = makeBandSetup({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      const band = await make()
      const thesis = trackNamed('thesis')

      ctx.currentTime = 10
      band.ahead({ light: 0.6, warmth: 0.5 })
      band.moveTo({ key: 0, sky: 'sea', near: 0.5, voice: 'piano' })
      ctx.currentTime = 11
      band.ahead({ light: 0.6, warmth: 0.5 })
      expect(thesis.noteOn).toHaveBeenCalledTimes(2)

      band.rest()
      expect(thesis.noteOff.mock.calls.map(([id]) => id)).toEqual([100, 101])

      thesis.noteOff.mockClear()
      band.rest()
      expect(thesis.noteOff).not.toHaveBeenCalled()

      ctx.currentTime = 11.1
      band.ahead({ light: 0.6, warmth: 0.5 })
      expect(thesis.noteOn).toHaveBeenCalledTimes(3)
    })
  })
})
