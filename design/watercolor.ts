// The site's paint and sound for a page that React does not make: a board of a design canvas.
// What is pressed here is the site's own, wired to the markup instead of drawn by a component.

import { Instrument } from '../app/frontend/looks/player'
import { roomsOf, type Art, type Look } from '../app/frontend/looks/looks'
import { theContext } from '../app/frontend/sound/context'
import { ear } from '../app/frontend/sound/ear'
import { placeOf } from '../app/frontend/sound/place'
import { close, fade, keep, kept, moveTo, NAMES, open, sounding, turn, type Parts } from '../app/frontend/sound/switch'
import { laySheet } from '../app/frontend/watercolor/lay'
import worklet from 'virtual:worklet'

interface Page {
  look: Look
  component: string
  art?: Art
  url: string
  seed: number
}

/** A worklet has to have an address, and which kind is allowed is for the page's host to say. */
async function addressOfWorklet() {
  const { audioWorklet } = theContext()
  const script = new Blob([worklet], { type: 'text/javascript' })
  for (const address of [() => URL.createObjectURL(script), () => `data:text/javascript;base64,${btoa(worklet)}`, () => new URL('wasm-device.js', document.baseURI).href]) {
    try {
      const url = address()
      await audioWorklet.addModule(url)
      globalThis.__worklet = url
      return
    } catch {
      // the next
    }
  }
}

function wireSound(root: HTMLElement, page: Page, signal: AbortSignal) {
  const rooms = roomsOf(page.look, page.component, page.art)
  const holder = root.querySelector('.wc-sound')
  const main = holder?.querySelector<HTMLButtonElement>('[data-sound="all"]')
  if (!rooms || !holder || !main) return
  let parts: Parts = kept()
  const say = () => {
    const on = sounding()
    main.setAttribute('aria-pressed', String(on))
    main.lastElementChild!.textContent = on ? 'Sound off' : 'Sound'
    for (const [part] of NAMES) {
      const button = holder.querySelector<HTMLButtonElement>(`[data-sound="${part}"]`)
      if (!button) continue
      button.hidden = !on
      button.setAttribute('aria-pressed', String(parts[part]))
    }
  }
  main.addEventListener(
    'click',
    async () => {
      if (sounding()) close()
      else {
        await addressOfWorklet()
        await open(placeOf(rooms, page.url), parts)
        window.dispatchEvent(new CustomEvent('wc:again'))
      }
      say()
    },
    { signal },
  )
  for (const [part] of NAMES)
    holder.querySelector(`[data-sound="${part}"]`)?.addEventListener(
      'click',
      () => {
        parts = { ...parts, [part]: !parts[part] }
        keep(parts)
        turn(part, parts[part])
        say()
      },
      { signal },
    )
  document.addEventListener('visibilitychange', () => sounding() && fade(!document.hidden), { signal })
  if (sounding()) moveTo(placeOf(rooms, page.url))
  say()
}

function wireScore(root: HTMLElement, signal: AbortSignal) {
  const score = root.querySelector<HTMLElement>('.wc-score')
  const button = score?.querySelector<HTMLButtonElement>('.wc-buttons button')
  const hand = score?.querySelector<HTMLElement>('.wc-hand')
  if (!score || !button) return
  const word = button.lastElementChild!
  const marks = [...score.querySelectorAll<HTMLElement>('.wc-note')]
  const notes = marks.map((mark) => {
    const [lane, year, length, at] = (mark.dataset.note ?? '').split(' ').map(Number)
    return { mark, lane, year, length, at }
  })
  let instrument: Instrument | undefined
  let playing = false
  let heard: Element | undefined
  const show = (mark?: Element) => {
    heard?.removeAttribute('data-heard')
    heard = mark
    mark?.setAttribute('data-heard', '')
    mark?.dispatchEvent(new CustomEvent('wc:heard', { bubbles: true }))
  }
  const say = () => {
    button.setAttribute('aria-pressed', String(playing))
    word.textContent = playing ? 'Stop' : 'Play the score'
    if (hand) hand.hidden = !playing
  }
  button.addEventListener(
    'click',
    async () => {
      if (playing) return instrument?.stop()
      if (!globalThis.__worklet) await addressOfWorklet()
      const mine = (instrument ??= new Instrument())
      playing = ear.playing = true
      word.textContent = 'Stop'
      await mine.ready()
      mine.play(
        notes.map((note) => ({ ...note, heard: () => show(note.mark) })),
        () => {
          show()
          playing = ear.playing = false
          ear.hush?.(false)
          say()
        },
      )
      ear.hush?.(true)
      if (hand) hand.style.animationDuration = `${mine.lasts}s`
      say()
    },
    { signal },
  )
  for (const { mark, at, ...note } of notes)
    for (const kind of ['pointerenter', 'focus'])
      mark.addEventListener(
        kind,
        () => {
          if (!instrument || playing) return
          instrument.strike(note, at)
          mark.dispatchEvent(new CustomEvent('wc:heard', { bubbles: true }))
        },
        { signal },
      )
  signal.addEventListener('abort', () => instrument?.close())
  say()
}

/** Paints a board and makes it sound. Answers with what takes both away. */
export function mount(root: HTMLElement, page: Page) {
  const rooms = roomsOf(page.look, page.component, page.art)
  const sheet = root.querySelector<HTMLElement>('.painted-sheet')
  const gone = new AbortController()
  let lift: (() => void) | undefined
  if (rooms && sheet) {
    const lay = () => {
      if (gone.signal.aborted) return
      lift?.()
      lift = laySheet(sheet, rooms.compose, page.seed)
    }
    // Letters are cut from the face they are set in, so that has to be there first.
    const faces = ['400 40px Newsreader', 'italic 400 40px Newsreader', '700 40px Inter'].map((face) => document.fonts.load(face).catch(() => []))
    void Promise.race([Promise.all(faces), new Promise((done) => window.setTimeout(done, 2500))]).then(lay)
    let late = false
    document.fonts.addEventListener(
      'loadingdone',
      () => {
        if (late) return
        late = true
        window.setTimeout(lay, 200)
      },
      { signal: gone.signal },
    )
  }
  wireSound(root, page, gone.signal)
  wireScore(root, gone.signal)
  return {
    stop() {
      gone.abort()
      lift?.()
    },
  }
}
