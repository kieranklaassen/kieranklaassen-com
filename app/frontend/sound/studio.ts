// The sound of painting, made as it is needed and from noise: nothing is recorded and nothing loads.
//
// Every brush stroke is noise drawn over paper, every drop a bubble, and each is tuned to the page's
// scale. The music and the weather are the Band's (band.ts). Where that cannot be had, the studio has
// a plain one of its own: noise through a narrow band for rain, and slow chords of sines.

import type { Heard } from './ear'
import type { Band } from './band'
import type { Place } from './place'
import { CENTERS, chordOf, degreeOf, noteOf } from './scale'

/** What can be turned off by itself. */
export const PARTS = ['music', 'weather', 'paint'] as const
export type Part = (typeof PARTS)[number]

const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x))

/** So many strokes may begin in a tenth of a second. */
const MOST = 5

export class Studio {
  private readonly out: GainNode
  private readonly strokes: GainNode
  /** Where each part comes in, and goes. */
  private readonly parts: Record<Part, GainNode>
  private readonly air: GainNode
  private readonly drones: GainNode
  /** The Ambient Town engine, once it is there. */
  band?: Band
  private readonly room: ConvolverNode
  private readonly pink: AudioBuffer
  private readonly white: AudioBuffer
  private place: Place = { key: 0, sky: 'sea', near: 0.5, voice: 'piano' }
  private begun: number[] = []
  private nextDrone = 0
  private nextRain = 0
  private nextWave = 0
  private turns = 0

  constructor(
    readonly context: BaseAudioContext,
    private readonly random: () => number = Math.random,
  ) {
    const gain = (value: number, to: AudioNode) => {
      const node = context.createGain()
      node.gain.value = value
      node.connect(to)
      return node
    }
    const limit = context.createDynamicsCompressor()
    limit.threshold.value = -14
    limit.ratio.value = 8
    limit.attack.value = 0.004
    limit.release.value = 0.2
    limit.connect(context.destination)
    this.out = gain(0, limit)
    this.white = this.noise(2, false)
    this.pink = this.noise(5, true)
    this.room = context.createConvolver()
    this.room.buffer = this.impulse(3.2)
    this.room.connect(gain(0.5, this.out))
    this.air = gain(1, this.out)
    this.parts = { music: gain(1, this.air), weather: gain(1, this.air), paint: gain(1, this.out) }
    this.strokes = gain(0.9, this.parts.paint)
    this.strokes.connect(gain(0.3, this.room))
    this.drones = gain(1, this.parts.music)
  }

  private noise(seconds: number, pink: boolean) {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    let a = 0
    let b = 0
    let c = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      if (!pink) data[i] = white
      else {
        a = 0.99765 * a + white * 0.099046
        b = 0.963 * b + white * 0.2965164
        c = 0.57 * c + white * 1.0526913
        data[i] = (a + b + c + white * 0.1848) * 0.2
      }
    }
    return buffer
  }

  /** A room with a wooden floor: it darkens as it rings. */
  private impulse(seconds: number) {
    const rate = this.context.sampleRate
    const buffer = this.context.createBuffer(2, rate * seconds, rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let low = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length
        low += ((Math.random() * 2 - 1) - low) * (0.5 * (1 - t) ** 2 + 0.05)
        data[i] = low * (1 - t) ** 2.6 * Math.min(1, i / (rate * 0.012))
      }
    }
    return buffer
  }

  get sounding() {
    return this.out.gain.value > 0.001
  }

  /** Comes up slowly, and goes faster. */
  fade(up: boolean, slowly = false, at = this.context.currentTime) {
    this.out.gain.cancelScheduledValues(at)
    this.out.gain.setTargetAtTime(up ? 0.8 : 0, at, up ? (slowly ? 1.6 : 0.5) : 0.12)
  }

  hush(hushed: boolean, at = this.context.currentTime) {
    this.air.gain.setTargetAtTime(hushed ? 0.12 : 1, at, hushed ? 0.3 : 1.2)
  }

  /** Where the engine's music and weather go, so that they are turned off with the rest. */
  get inputs() {
    return { music: this.parts.music, weather: this.parts.weather }
  }

  turn(part: Part, on: boolean, at = this.context.currentTime) {
    this.parts[part].gain.setTargetAtTime(on ? 1 : 0, at, on ? 0.3 : 0.1)
  }

  moveTo(place: Place) {
    this.place = place
    this.band?.moveTo(place)
    this.nextDrone = Math.min(this.nextDrone, this.context.currentTime + 0.6)
  }

  private get center() {
    return CENTERS[this.place.key % CENTERS.length]
  }

  private panned(pan: number, to: AudioNode) {
    const node = this.context.createStereoPanner()
    node.pan.value = clamp(pan * 0.85, -1, 1)
    node.connect(to)
    return node
  }

  private source(buffer: AudioBuffer, at: number, lasts: number) {
    const node = this.context.createBufferSource()
    node.buffer = buffer
    node.loop = true
    node.start(at, this.random() * buffer.duration * 0.9)
    node.stop(at + lasts)
    return node
  }

  /** A gain that swells and goes: how loud, how long it takes to come, how long to leave. */
  private swell(at: number, peak: number, rise: number, fall: number, to: AudioNode) {
    const node = this.context.createGain()
    node.gain.setValueAtTime(0.00001, at)
    node.gain.linearRampToValueAtTime(peak, at + rise)
    node.gain.exponentialRampToValueAtTime(0.00001, at + rise + fall)
    node.connect(to)
    return node
  }

  private filter(type: BiquadFilterType, frequency: number, q: number, to: AudioNode) {
    const node = this.context.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    node.connect(to)
    return node
  }

  // ------------------------------------------------------------------------------------ the brush

  /** A brush drawn over the paper's tooth: it is loudest where it is pressed, and dries out. */
  private brush(at: number, pan: number, size: number, light: number, lasts: number, loud: number) {
    const long = clamp(lasts * 0.5, 0.16, 1.3)
    const bright = 700 + 3200 * light * (1 - 0.6 * size) + 500 * this.random()
    const to = this.panned(pan, this.strokes)
    const level = this.swell(at, loud, long * 0.22, long, to)
    const band = this.filter('bandpass', bright, 0.9, level)
    band.frequency.setValueAtTime(bright * 0.7, at)
    band.frequency.linearRampToValueAtTime(bright * 1.25, at + long * 0.3)
    band.frequency.exponentialRampToValueAtTime(bright * 0.55, at + long * 1.15)
    // the bristles catch on the tooth
    const tooth = this.context.createGain()
    tooth.gain.value = 0.72
    tooth.connect(band)
    const bite = this.context.createOscillator()
    bite.type = 'triangle'
    bite.frequency.setValueAtTime(14 + 16 * this.random(), at)
    bite.frequency.linearRampToValueAtTime(7 + 6 * this.random(), at + long)
    const depth = this.context.createGain()
    depth.gain.value = 0.28
    bite.connect(depth).connect(tooth.gain)
    bite.start(at)
    bite.stop(at + long * 1.25)
    this.source(this.white, at, long * 1.25).connect(tooth)
    // and under it the water it carries
    const wet = this.swell(at, loud * 0.9, long * 0.3, long * 0.8, to)
    this.source(this.pink, at, long * 1.2).connect(this.filter('lowpass', 320 + 420 * light, 0.5, wet))
  }

  /** A bubble: a short sine whose pitch runs up as it closes. */
  private bubble(at: number, pan: number, pitch: number, loud: number, long = 0.06) {
    const to = this.panned(pan, this.strokes)
    const level = this.swell(at, loud, 0.003, long, to)
    const sine = this.context.createOscillator()
    sine.frequency.setValueAtTime(pitch, at)
    sine.frequency.exponentialRampToValueAtTime(pitch * (1.5 + 0.5 * this.random()), at + long)
    sine.connect(level)
    sine.start(at)
    sine.stop(at + long + 0.05)
  }

  /** Noise through a band so narrow that it sings: a raindrop with a long decay. */
  private sing(at: number, pan: number, pitch: number, loud: number, long: number, to: AudioNode = this.strokes) {
    const place = this.panned(pan, to)
    const level = this.swell(at, loud, 0.012, long, place)
    const band = this.filter('bandpass', pitch, 34, level)
    const twice = this.context.createGain()
    twice.gain.value = 6
    twice.connect(band)
    this.source(this.pink, at, long + 0.1).connect(twice)
    // a little of the pitch itself, so that it has a middle
    const sine = this.context.createOscillator()
    sine.frequency.value = pitch
    sine.connect(this.swell(at, loud * 0.32, 0.02, long * 0.7, place))
    sine.start(at)
    sine.stop(at + long)
  }

  /** What was thrown lands: a thud, the slap of it, and the spray that comes down after. */
  private splash(at: number, pan: number, size: number, pitch: number) {
    const to = this.panned(pan, this.strokes)
    const thud = this.context.createOscillator()
    thud.frequency.setValueAtTime(150 - 40 * size, at)
    thud.frequency.exponentialRampToValueAtTime(52, at + 0.14)
    thud.connect(this.swell(at, 0.2 + 0.16 * size, 0.004, 0.2, to))
    thud.start(at)
    thud.stop(at + 0.3)
    const slap = this.filter('lowpass', 5200, 0.7, this.swell(at, 0.26 + 0.2 * size, 0.003, 0.16 + 0.1 * size, to))
    slap.frequency.setValueAtTime(5200, at)
    slap.frequency.exponentialRampToValueAtTime(380, at + 0.22)
    this.source(this.white, at, 0.4).connect(slap)
    const drops = Math.round(7 + 9 * size)
    for (let i = 0; i < drops; i++) {
      const after = 0.03 + 0.5 * this.random() ** 1.6
      this.bubble(at + after, pan + (this.random() - 0.5) * 0.9, 480 + 1900 * this.random(), 0.05 * (1 - after), 0.02 + 0.05 * this.random())
    }
    this.sing(at + 0.02, pan, pitch, 0.1, 2.2)
  }

  /** Whether one more stroke may begin now. The large ones go first. */
  private hasRoom(at: number, size: number) {
    this.begun = this.begun.filter((one) => one > at - 0.1)
    const most = size > 0.3 ? MOST + 2 : MOST
    if (this.begun.length >= most) return false
    this.begun.push(at)
    return true
  }

  /** Sounds one thing the paint did. */
  hears({ gesture, pan, size, light, warmth, lasts, index = 0 }: Heard, at = this.context.currentTime + 0.01) {
    const pitch = noteOf(this.center, degreeOf(light, warmth))
    const degree = degreeOf(light, warmth)
    if (gesture === 'drop') {
      this.bubble(at, pan, pitch * 1.6, 0.13, 0.05)
      this.band?.touch(degree, 0.2)
      return this.sing(at + 0.03, pan, pitch * 2, this.band ? 0.05 : 0.13, 1.5 + 1.2 * (1 - light))
    }
    if (gesture === 'rain') {
      if (this.band) return this.band.touch(degree, 0.13)
      return this.sing(at, pan, pitch * 2, 0.085, 2.6, this.parts.music)
    }
    if (gesture === 'splash') {
      this.band?.touch(degree - 7, 0.3)
      return this.splash(at, pan, size, pitch * 2)
    }
    if (!this.hasRoom(at, size)) return
    const loud = 0.045 + 0.09 * Math.sqrt(size)
    switch (gesture) {
      case 'square':
        this.brush(at, pan, size, light, lasts, loud)
        if (this.random() < 0.3) this.bubble(at + 0.1 + 0.2 * this.random(), pan, 500 + 900 * this.random(), 0.018)
        break
      case 'letter':
        this.brush(at, pan, size, light, lasts, loud * 1.1)
        if (this.band) this.band.letter(index)
        else this.sing(at + 0.06, pan, noteOf(this.center, (index % 12) - 4) * 2, 0.035, 1.6)
        break
      case 'puddle':
        this.bubble(at, pan, 380 + 700 * this.random(), 0.06, 0.05)
        this.brush(at, pan, 0.02, 0.4, 0.2, 0.03)
        break
      case 'bank':
        this.brush(at, pan, 0.6, light * 0.5, lasts * 1.5, loud * 0.8)
        break
      case 'flood':
        this.brush(at, pan, 0.7, 0.5, lasts, 0.075)
        this.sing(at + 0.04, pan, pitch, 0.06, 1.8)
        break
      case 'run': {
        // it trickles: the bubbles come closer together, and lower
        const count = Math.round(3 + lasts * 3.5)
        for (let i = 0; i < count; i++) this.bubble(at + (i / count) ** 0.8 * lasts + 0.05 * this.random(), pan, 1100 - (700 * i) / count + 260 * this.random(), 0.026, 0.035)
      }
    }
  }

  // ------------------------------------------------------------------------------- and all around

  /** Readies the studio's own ambience until `until`. Where it rains, `rain` is told, and it may let the paint answer. */
  ahead(until: number, rain?: (at: number) => void) {
    const now = this.context.currentTime
    if (this.band) {
      if (this.nextRain < now) {
        rain?.(now)
        this.nextRain = now + 1.2 + 3.4 * this.random() ** 1.5
      }
      return
    }
    for (const [name, gap] of [['nextDrone', 0.3], ['nextRain', 1.4], ['nextWave', 0.5]] as const) if (this[name] < now) this[name] = now + gap
    while (this.nextDrone < until) {
      this.drone(this.nextDrone)
      this.nextDrone += 8.5 + 2 * this.random()
    }
    while (this.nextRain < until) {
      if (rain) rain(this.nextRain)
      else this.hears({ gesture: 'rain', pan: this.random() * 2 - 1, size: 0, light: this.random(), warmth: this.random(), lasts: 0 }, this.nextRain)
      this.nextRain += 0.9 + 2.6 * this.random() ** 1.5
    }
    while (this.nextWave < until) {
      this.wave(this.nextWave)
      this.nextWave += 6.5 + 3 * this.random()
    }
  }

  /** A slow chord of sines, a little apart between the ears. */
  private drone(at: number) {
    const distance = [3, 5, 2, 4, 6][this.turns++ % 5]
    const rises = 3.2
    const holds = 4.5
    const falls = 6.5
    chordOf(this.center - 12, distance).forEach((pitch, i) => {
      for (const side of [-1, 1]) {
        const level = this.context.createGain()
        level.gain.setValueAtTime(0.00001, at)
        level.gain.linearRampToValueAtTime([0.02, 0.016, 0.014, 0.012, 0.009, 0.018][i], at + rises + i * 0.4)
        level.gain.setValueAtTime([0.02, 0.016, 0.014, 0.012, 0.009, 0.018][i], at + rises + holds)
        level.gain.linearRampToValueAtTime(0.00001, at + rises + holds + falls)
        level.connect(this.panned(side * 0.8, this.drones))
        const sine = this.context.createOscillator()
        sine.frequency.setValueAtTime(pitch * (1 + 0.0016 * side * (this.random() + 0.3)), at)
        sine.frequency.linearRampToValueAtTime(pitch * (1 - 0.0016 * side * (this.random() + 0.3)), at + rises + holds + falls)
        sine.connect(level)
        sine.start(at)
        sine.stop(at + rises + holds + falls + 0.1)
      }
    })
  }

  /** Water drawing up a shore and back, or on a page away from it the air in the room. */
  private wave(at: number) {
    const sea = this.place.sky === 'sea' ? this.place.near : 0.1
    const rises = 2.6 + 1.4 * this.random()
    const falls = 4.5 + 2 * this.random()
    const to = this.panned((this.random() - 0.5) * 1.2, this.parts.weather)
    const level = this.swell(at, 0.016 + 0.075 * sea, rises, falls, to)
    const low = this.filter('lowpass', 260, 0.4, level)
    low.frequency.setValueAtTime(220, at)
    low.frequency.linearRampToValueAtTime(420 + 1300 * sea, at + rises)
    low.frequency.exponentialRampToValueAtTime(200, at + rises + falls)
    this.source(this.pink, at, rises + falls).connect(low)
    if (sea > 0.2) {
      const foam = this.filter('highpass', 2400, 0.3, this.swell(at + rises * 0.7, 0.008 * sea, rises * 0.5, falls * 0.6, to))
      this.source(this.white, at + rises * 0.7, rises + falls).connect(foam)
    }
  }
}
