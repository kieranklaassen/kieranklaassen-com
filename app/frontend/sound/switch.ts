import { theContext } from './context'
import { ear } from './ear'
import type { Place } from './place'
import type { Part, Studio } from './studio'

// One studio for the whole visit: going from page to page leaves it sounding.
let studio: Studio | undefined
let timer: number | undefined
let stirred = 0
let scrolledTo = 0

const AHEAD = 1.2
const EVERY = 250
const KEPT = 'wc-sound'
export const NAMES: [Part, string][] = [
  ['music', 'Music'],
  ['weather', 'Weather'],
  ['paint', 'Paint'],
]

export type Parts = Record<Part, boolean>

export const ALL: Parts = { music: true, weather: true, paint: true }

export function kept(): Parts {
  try {
    return { ...ALL, ...JSON.parse(localStorage.getItem(KEPT) ?? '{}') }
  } catch {
    return ALL
  }
}

export function keep(parts: Parts) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(parts))
  } catch {
    // a browser that keeps nothing still plays
  }
}

/** Rain falls where the paint is: the sheet picks the wash, and sounds it. */
const rain = (at: number) => {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('wc:rain')), Math.max(0, at - theContext().currentTime) * 1000)
}

/** A chord is seen too: drops fall one after the other, as its voices come in. */
const chord = () => [0, 0.5, 1.1].forEach((after) => rain(theContext().currentTime + after))

const scrolled = () => {
  stirred = Math.min(1, stirred + Math.abs(window.scrollY - scrolledTo) / 1400)
  scrolledTo = window.scrollY
}

/** The engine is fetched beside the first strokes. Without it, the studio plays what it has. */
async function engage(playing: Studio, place: Place) {
  try {
    const { Band } = await import('./band')
    const band = await Band.make(playing.context, playing.inputs, place)
    playing.band = band
  } catch (error) {
    console.warn('The engine could not be had, so the page plays without it.', error)
  }
}

export async function open(place: Place, parts: Parts) {
  const context = theContext()
  await context.resume()
  if (!studio) {
    const { Studio } = await import('./studio')
    studio = new Studio(context)
    void engage(studio, place)
  }
  const playing = studio
  playing.moveTo(place)
  for (const [part] of NAMES) playing.turn(part, parts[part])
  playing.fade(true)
  scrolledTo = window.scrollY
  let still = 0
  const more = () => {
    playing.ahead(context.currentTime + AHEAD, rain)
    playing.band?.ahead(ear.view?.(), chord)
    stirred *= 0.8
    if (Math.abs(stirred - still) > 0.02) playing.band?.stir((still = stirred))
  }
  more()
  window.clearInterval(timer)
  timer = window.setInterval(more, EVERY)
  window.addEventListener('scroll', scrolled, { passive: true })
  ear.hears = (heard) => playing.hears(heard)
  ear.hush = (hushed) => playing.hush(hushed)
}

export function close() {
  window.clearInterval(timer)
  timer = undefined
  window.removeEventListener('scroll', scrolled)
  ear.hears = ear.hush = undefined
  studio?.fade(false)
  studio?.band?.rest()
  window.setTimeout(() => !timer && !ear.playing && void theContext().suspend(), 900)
}

export const sounding = () => timer !== undefined
export const moveTo = (place: Place) => studio?.moveTo(place)
export const turn = (part: Part, on: boolean) => studio?.turn(part, on)
export const fade = (up: boolean) => studio?.fade(up)
