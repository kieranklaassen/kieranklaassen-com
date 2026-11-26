import { theContext } from './context'
import { ear } from './ear'
import type { Place } from './place'
import type { Part, Studio } from './studio'

// One studio for the whole visit: going from page to page leaves it sounding.
let studio: Studio | undefined
let timer: number | undefined
/** Counts the openings and closings: one that has been overtaken by the next does nothing more. */
let word = 0
const listeners = new Set<() => void>()
let stirred = 0
let scrolledTo = 0

const AHEAD = 1.2
const EVERY = 250
const KEPT = 'wc-sound'
const SILENT = 'wc-silent'
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

/** Sounds a place. Slowly, when nobody asked for it by name. */
export async function open(place: Place, parts: Parts, slowly = false) {
  const mine = ++word
  const context = theContext()
  await context.resume()
  const { Studio } = await import('./studio')
  if (mine !== word) return
  if (!studio) {
    studio = new Studio(context)
    void engage(studio, place)
  }
  const playing = studio
  playing.moveTo(place)
  for (const [part] of NAMES) playing.turn(part, parts[part])
  playing.fade(!document.hidden, slowly)
  if (ear.playing) playing.hush(true)
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
  window.addEventListener('blur', givesWay)
  ear.hears = (heard) => playing.hears(heard)
  ear.hush = (hushed) => playing.hush(hushed)
  tell()
}

export function close() {
  const mine = ++word
  window.clearInterval(timer)
  timer = undefined
  window.removeEventListener('scroll', scrolled)
  ear.hears = ear.hush = undefined
  studio?.fade(false)
  studio?.band?.rest()
  window.setTimeout(() => mine === word && !ear.playing && void theContext().suspend(), 900)
  tell()
}

// ---------------------------------------------------------------------------- on unless it is turned off

const tell = () => listeners.forEach((listener) => listener())

export function listen(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function wanted() {
  try {
    return localStorage.getItem(SILENT) === null
  } catch {
    return true
  }
}

/** Remembers whether the sound is wanted. Only somebody's own press says so. */
export function want(on: boolean) {
  gaveWay = false
  try {
    if (on) localStorage.removeItem(SILENT)
    else localStorage.setItem(SILENT, '1')
  } catch {
    // a browser that keeps nothing is asked again on the next page
  }
}

/** Somebody has started a track that is embedded in the page, so the page falls silent and stays it. */
let gaveWay = false
const givesWay = () => {
  if (document.activeElement?.tagName !== 'IFRAME') return
  gaveWay = true
  if (sounding()) close()
}

/** What begins something else than the page's own sound. */
const NOT_A_START = '.wc-sound, .wc-chooser, a[target="_blank"]'

/**
 * Starts the sound at the first click or tap anywhere, which is as early as a browser allows. Not at a
 * key, so that a screen reader is not talked over, and not where data is to be saved. Nothing is
 * fetched before it starts. Answers with what calls it off.
 */
export function arm(start: () => void) {
  window.addEventListener('blur', givesWay)
  const { connection, userActivation } = navigator as Navigator & { connection?: { saveData?: boolean } }
  if (sounding() || gaveWay || !wanted() || connection?.saveData) return () => {}
  if (userActivation?.hasBeenActive) {
    start()
    return () => {}
  }
  const first = (event: Event) => {
    if (gaveWay || !(event.target instanceof Element) || event.target.closest(NOT_A_START)) return
    off()
    start()
  }
  const off = () => GESTURES.forEach((kind) => document.removeEventListener(kind, first, { capture: true }))
  GESTURES.forEach((kind) => document.addEventListener(kind, first, { capture: true }))
  return off
}
const GESTURES = ['pointerup', 'click']

export const sounding = () => timer !== undefined
export const moveTo = (place: Place) => studio?.moveTo(place)
export const turn = (part: Part, on: boolean) => studio?.turn(part, on)
export const fade = (up: boolean) => studio?.fade(up)
