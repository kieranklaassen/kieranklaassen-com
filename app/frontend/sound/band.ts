// The music and the weather of a page, played by the Ambient Town engine. It is loaded when Sound is
// pressed, and not before.
//
// Thesis plays the chords. Its center is the key of the page, and the note under each chord is read
// off the paint in the window, so scrolling from blue to yellow is a line of music. Atmosphere is the
// sea, the rain, the wind or the fire outside. A felt piano, a handpan or drops of glass play the
// letters of a title as they are painted.

import {
  createAtmosphere,
  createDroplets,
  createFeltPiano,
  createHandpan,
  createPlateReverb,
  createThesis,
  InstrumentTrack,
  ReturnTrack,
} from '../../../vendor/engine/engine.js'
import type { View } from './ear'
import { CENTERS, hertz, noteOf } from './scale'
import { pitchOf } from '../looks/player'
import type { Place, Sky, Voice } from './place'

const SKIES: Record<Sky, Record<string, number>> = {
  sea: { type: 2, density: 0.32, movement: 0.9, tone: 0.5, resonance: 0, size: 0.4, attack: 5, release: 7, volume: -8 },
  rain: { type: 1, density: 0.4, movement: 0.4, tone: 0.5, resonance: 0, size: 0.3, attack: 4, release: 6, volume: -8 },
  wind: { type: 0, density: 0.36, movement: 0.6, tone: 0.42, resonance: 0.12, size: 0.35, attack: 4, release: 6, volume: -7 },
  fire: { type: 3, density: 0.4, movement: 0.55, tone: 0.45, resonance: 0.1, size: 0.2, attack: 4, release: 6, volume: -13 },
  dust: { type: 4, density: 0.3, movement: 0.4, tone: 0.42, resonance: 0, size: 0.2, attack: 4, release: 6, volume: -18 },
}

const SKY_NOTE = 1
const KEPT = 3

export class Band {
  readonly music: GainNode
  readonly weather: GainNode
  private place: Place = { key: 0, sky: 'sea', near: 0.5, voice: 'piano' }
  private thesis?: InstrumentTrack
  private sky?: InstrumentTrack
  private voices: Partial<Record<Voice, InstrumentTrack>> = {}
  private making: Partial<Record<Voice, Promise<InstrumentTrack>>> = {}
  private room?: ReturnTrack
  private ids = 100
  private nextChord = 0
  private held: { id: number; until: number }[] = []
  private step = 0

  private constructor(
    readonly context: BaseAudioContext,
    out: { music: AudioNode; weather: AudioNode },
  ) {
    this.music = context.createGain()
    this.weather = context.createGain()
    this.music.connect(out.music)
    this.weather.connect(out.weather)
  }

  static async make(context: BaseAudioContext, out: { music: AudioNode; weather: AudioNode }, place: Place) {
    const band = new Band(context, out)
    band.place = place
    const [thesis, sky, reverb] = await Promise.all([
      createThesis(context, { params: { ...band.chordParams(), attack: 2.6, release: 5, resonance: 62, width: 92, mode: 1, breatheRate: 0.16, strum: 30, mirrorEnabled: 1, octaflipEnabled: 1, middleEnabled: 1, mirrorMiddleEnabled: 0, centerEnabled: 1, scale: 0 } }),
      createAtmosphere(context, { params: SKIES[place.sky] }),
      createPlateReverb(context, { params: { mix: 1, decay: 0.82, damping: 0.45, predelayMs: 24 } }),
    ])
    band.room = new ReturnTrack({ name: 'room', device: reverb, destination: band.music, context })
    const chords = new InstrumentTrack({ name: 'thesis', device: thesis, destination: band.music, context })
    chords.strip.setLevel(0.5)
    chords.strip.sends.add(band.room, { level: 0.4 })
    band.thesis = chords
    const outside = new InstrumentTrack({ name: 'sky', device: sky, destination: band.weather, context })
    band.sky = outside
    band.weather.gain.value = place.near
    outside.noteOn(SKY_NOTE, hertz(48), 0.8)
    void band.voice(place.voice)
    return band
  }

  private get center() {
    return CENTERS[this.place.key % CENTERS.length]
  }

  private chordParams() {
    return { center: this.center, root: (this.center - 2 + 120) % 12 }
  }

  moveTo(place: Place) {
    const was = this.place
    this.place = place
    const now = this.context.currentTime
    for (const [name, value] of Object.entries(this.chordParams())) this.thesis?.device.setParam(name, value)
    this.weather.gain.setTargetAtTime(place.near, now, 1.5)
    void this.voice(place.voice)
    this.nextChord = Math.min(this.nextChord, now + 0.8)
    if (was.sky === place.sky) return
    // out with the old weather, and in with the new
    const sky = this.sky
    sky?.noteOff(SKY_NOTE)
    window.setTimeout(() => {
      for (const [name, value] of Object.entries(SKIES[this.place.sky])) sky?.device.setParam(name, value)
      sky?.noteOn(SKY_NOTE, hertz(48), 0.8)
    }, 2500)
  }

  /** The wind in scrolling: how fast, 0 to 1. */
  stir(amount: number) {
    const base = SKIES[this.place.sky]
    this.sky?.device.setParam('tone', Math.min(1, base.tone + 0.3 * amount))
    this.sky?.device.setParam('density', Math.min(1, base.density + 0.35 * amount))
  }

  /** An instrument is fetched the first time a page plays it. */
  private voice(name: Voice) {
    return (this.making[name] ??= (async () => {
      const device = await (name === 'piano'
        ? createFeltPiano(this.context, { params: { reverbMix: 0.2 } })
        : name === 'pan'
          ? createHandpan(this.context, { params: { decay: 6, touch: 0.2, shimmer: 0.7, sympathy: 0.8 } })
          : createDroplets(this.context, { params: { rain: 0.4, material: 0, loose: 1, size: 0.5, spread: 0, ring: 1.6, soft: 0.3, trail: 0 } }))
      const track = new InstrumentTrack({ name, device, destination: this.music, context: this.context })
      track.strip.setLevel(name === 'piano' ? 0.5 : name === 'pan' ? 0.5 : 0.55)
      if (this.room) track.strip.sends.add(this.room, { level: 0.5 })
      return (this.voices[name] = track)
    })())
  }

  /** Waits for the piano, which plays the score. */
  ready() {
    return this.voice('piano')
  }

  /** One note on the page's instrument, let go after so long. */
  pluck(frequency: number, gain: number, rings: number, voice: Voice = this.place.voice) {
    const track = this.voices[voice]
    if (!track) return
    const id = this.ids++
    track.noteOn(id, frequency, gain)
    window.setTimeout(() => track.noteOff(id), rings * 1000)
  }

  /** The note of the so-manyth letter: up the scale and down it again. */
  letter(index: number, gain = 0.26) {
    const degree = [0, 2, 4, 1, 5, 7, 4, 9, 6, 8, 3, 5][index % 12] - 3
    this.pluck(noteOf(this.center, degree), gain * (0.8 + 0.4 * Math.random()), 1.4)
  }

  /** The pigment that was touched, as a note. */
  touch(degree: number, gain: number) {
    this.pluck(noteOf(this.center, degree) * 2, gain, 1.2)
  }

  /** Plays on. A chord is told of as it is played, so that the paint may answer. */
  ahead(view: View | undefined, chord?: (degree: number) => void) {
    const now = this.context.currentTime
    for (const one of this.held.filter((one) => one.until <= now)) this.thesis?.noteOff(one.id)
    this.held = this.held.filter((one) => one.until > now)
    if (!this.thesis || now < this.nextChord) return
    const { light, warmth } = view ?? { light: 0.6, warmth: 0.5 }
    const round = [0, 3, -2, 1, 4, -1][this.step++ % 6]
    const degree = Math.round((light * 0.6 + warmth * 0.4) * 12) - 6 + round
    const id = this.ids++
    this.thesis.device.setParam('resonance', 48 + 30 * light)
    this.thesis.noteOn(id, hertz(pitchOf(this.center, degree || 2)), 0.4)
    this.held.push({ id, until: now + 5.5 })
    for (const old of this.held.splice(0, this.held.length - KEPT)) this.thesis.noteOff(old.id)
    this.nextChord = now + 7 + 2.5 * Math.random()
    chord?.(degree)
  }

  /** Lets go of everything, for a page that is out of hearing. */
  rest() {
    for (const { id } of this.held) this.thesis?.noteOff(id)
    this.held = []
    this.nextChord = 0
  }
}
