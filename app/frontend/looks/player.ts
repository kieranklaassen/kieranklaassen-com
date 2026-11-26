// The score, sounded. Nothing here is made before somebody presses Play.
//
// Every stroke is one note of a scale, and five voices go with it, found by geometry about a center
// that is not the root: its mirror, the middle between it and the center, that middle's mirror, the
// middle an octave over on the other side, and the center itself. All of it is counted in degrees of
// the scale, so it stays in key. The center is the line through the middle of the staff, so a
// voice's place in the picture is its place in the chord.

export interface Note {
  /** Its lane, 0 at the top of eight. */
  lane: number
  /** Which year it is of: the key moves a fourth with every year. */
  year: number
  /** How long its title is: it rings as long. */
  length: number
}

export interface Timed extends Note {
  /** When, from 0 to 1 of the whole. */
  at: number
  heard: () => void
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const CENTER_DEGREE = 1 // the second
// The center of every key, near the middle of the keyboard: C, F, B flat, E flat, A flat.
const CENTERS = [62, 67, 60, 65, 58]
const LASTS = 28
const AHEAD = 0.12
const STRUM = 0.034

/** How many degrees a lane is from the center: an octave up at the top, an octave down at the foot. */
export const distanceOf = (lane: number) => 7 - 2 * lane

/** The six voices of a note, in degrees from the center. */
export function voicesOf(distance: number) {
  const middle = Math.sign(distance) * Math.round(Math.abs(distance) / 2)
  return [distance, -distance, middle, -middle, middle > 0 ? middle - 7 : middle + 7, 0]
}

/** The pitch so many degrees of the scale from the center. */
export function pitchOf(center: number, degrees: number) {
  const degree = CENTER_DEGREE + degrees
  const octave = Math.floor(degree / 7)
  return center - MAJOR[CENTER_DEGREE] + MAJOR[degree - octave * 7] + 12 * octave
}

const SHARES = [1, 0.62, 0.42, 0.36, 0.26, 0.24]

export class Instrument {
  private context = new AudioContext()
  private out = this.context.createDynamicsCompressor()
  private level = this.context.createGain()
  private timers: number[] = []
  private ended: (() => void) | undefined

  static get possible() {
    return 'AudioContext' in window
  }

  constructor() {
    const { context } = this
    this.level.gain.value = 0.8
    const wet = context.createConvolver()
    const seconds = 3.4
    const impulse = context.createBuffer(2, context.sampleRate * seconds, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3
    }
    wet.buffer = impulse
    const wetLevel = context.createGain()
    wetLevel.gain.value = 0.42
    this.level.connect(this.out).connect(context.destination)
    this.level.connect(wet).connect(wetLevel).connect(this.out)
  }

  get lasts() {
    return LASTS
  }

  /** Sounds one note with its voices, now or a little ahead. */
  strike({ lane, year, length }: Note, at = 0.5, ahead = 0) {
    const { context } = this
    if (context.state === 'suspended') void context.resume()
    const center = CENTERS[year % CENTERS.length]
    const rings = 1.5 + Math.min(80, length) / 20
    voicesOf(distanceOf(lane)).forEach((degrees, i) => {
      const when = context.currentTime + ahead + i * STRUM * (0.7 + 0.6 * Math.random())
      const pitch = 440 * 2 ** ((pitchOf(center, degrees) - 69) / 12)
      const tail = rings * (i === 0 ? 1 : 0.85)
      const level = context.createGain()
      level.gain.setValueAtTime(0, when)
      level.gain.linearRampToValueAtTime(0.16 * SHARES[i], when + (i === 0 ? 0.012 : 0.05))
      level.gain.exponentialRampToValueAtTime(0.0004, when + tail)
      const soft = context.createBiquadFilter()
      soft.type = 'lowpass'
      soft.frequency.setValueAtTime(pitch * 5, when)
      soft.frequency.exponentialRampToValueAtTime(pitch * 1.4, when + tail * 0.7)
      const place = context.createStereoPanner()
      place.pan.value = Math.max(-1, Math.min(1, at * 1.2 - 0.6 + (i % 2 ? 0.22 : -0.22) * Math.min(i, 1)))
      for (const [type, times, share] of [['triangle', 1, 1], ['sine', 2.003, 0.25]] as const) {
        const voice = context.createOscillator()
        const own = context.createGain()
        voice.type = type
        voice.frequency.value = pitch * times
        own.gain.value = share
        voice.connect(own).connect(soft)
        voice.start(when)
        voice.stop(when + tail + 0.05)
      }
      soft.connect(level).connect(place).connect(this.level)
    })
  }

  /** Plays from left to right. */
  play(notes: Timed[], ended: () => void) {
    this.stop()
    this.ended = ended
    this.level.gain.setTargetAtTime(0.8, this.context.currentTime, 0.02)
    for (const note of notes) {
      const when = note.at * LASTS
      this.timers.push(
        window.setTimeout(() => {
          this.strike(note, note.at, AHEAD)
          this.timers.push(window.setTimeout(note.heard, AHEAD * 1000))
        }, Math.max(0, when - AHEAD) * 1000),
      )
    }
    this.timers.push(window.setTimeout(() => this.stop(), (LASTS + 1) * 1000))
  }

  stop() {
    this.timers.forEach((timer) => window.clearTimeout(timer))
    this.timers = []
    const ended = this.ended
    this.ended = undefined
    ended?.()
  }

  close() {
    this.stop()
    this.level.gain.setTargetAtTime(0, this.context.currentTime, 0.05)
    window.setTimeout(() => void this.context.close(), 400)
  }
}
