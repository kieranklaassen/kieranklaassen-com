import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { ear } from '../sound/ear'
import { Instrument } from './player'
import type { PostSummary } from '../types/page'

const LANES: [string, RegExp][] = [
  ['Music & art', /music|art/i],
  ['Creating', /creat/i],
  ['Writing', /writing/i],
  ['Life', /personal|breath/i],
  ['Focus', /productiv/i],
  ['Teams', /leader/i],
  ['AI', /\bai\b|technology|every/i],
  ['Code', /code|ruby|develop/i],
]

const laneOf = (post: PostSummary) => {
  for (const category of post.categories) {
    const lane = LANES.findIndex(([, pattern]) => pattern.test(category))
    if (lane >= 0) return lane
  }
  return 1
}

const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000

/** Every thought at its date, in the lane of what it is about. */
export function Score({ posts }: { posts: PostSummary[] }) {
  const days = posts.map((post) => dayOf(post.date))
  const ordered = [...new Set(posts.map((post) => post.date))].sort()
  const first = Math.min(...days)
  const last = Math.max(...days)
  // Half by the calendar and half by order: the quiet years are kept short, not left out.
  const at = (date: string) => {
    const calendar = (dayOf(date) - first) / (last - first || 1)
    const order = ordered.indexOf(date) / (ordered.length - 1 || 1)
    return 0.02 + 0.91 * (0.25 * calendar + 0.75 * order)
  }
  const laid = posts.map((post) => ({ post, lane: laneOf(post), left: at(post.date) }))
  const widthOf = (lane: number, left: number) =>
    Math.min(0.033, ...laid.filter((one) => one.lane === lane && one.left > left).map((one) => one.left - left - 0.0015))
  const years = [...new Set(ordered.map((date) => date.slice(0, 4)))]

  const staff = useRef<HTMLDivElement>(null)
  const instrument = useRef<Instrument>(undefined)
  const heard = useRef<Element>(undefined)
  const [playing, setPlaying] = useState(false)
  const [sounding, setSounding] = useState(false)
  useEffect(() => () => instrument.current?.close(), [])

  const note = (post: PostSummary, lane: number) => ({ lane, year: years.indexOf(post.date.slice(0, 4)), length: post.title.length })
  const show = (mark?: Element) => {
    heard.current?.removeAttribute('data-heard')
    heard.current = mark
    mark?.setAttribute('data-heard', '')
    mark?.dispatchEvent(new CustomEvent('wc:heard', { bubbles: true }))
  }

  const press = async () => {
    if (playing) return instrument.current?.stop()
    if (!Instrument.possible) return
    const mine = (instrument.current ??= new Instrument())
    ear.playing = true
    setPlaying(true)
    await mine.ready()
    if (instrument.current !== mine || !ear.playing) return
    const marks = [...(staff.current?.querySelectorAll('.wc-note') ?? [])]
    mine.play(
      laid.map(({ post, lane, left }, i) => ({ ...note(post, lane), at: left, heard: () => show(marks[i]) })),
      () => {
        show()
        setPlaying(false)
        ear.playing = false
        ear.hush?.(false)
      },
    )
    ear.hush?.(true)
    setSounding(true)
  }

  // Once it has been played, the strokes sound under the hand too.
  const touch = (post: PostSummary, lane: number, left: number) => (event: SyntheticEvent) => {
    if (!sounding || playing) return
    instrument.current?.strike(note(post, lane), left)
    event.currentTarget.dispatchEvent(new CustomEvent('wc:heard', { bubbles: true }))
  }

  const quiet = () => {
    instrument.current?.close()
    instrument.current = undefined
    setSounding(false)
  }

  return (
    <div className="wc-score">
      <div className="wc-staff" ref={staff} data-paint="staff" data-lanes={LANES.length}>
        {playing && <i className="wc-hand" style={{ animationDuration: `${instrument.current?.lasts}s` }} aria-hidden="true" />}
        <ol>
          {laid.map(({ post, lane, left }) => (
            <li key={post.slug}>
              <a
                href={post.external_url ?? post.path}
                {...(post.external_url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="wc-note"
                data-paint="note"
                data-key={post.slug}
                data-note={`${lane} ${years.indexOf(post.date.slice(0, 4))} ${post.title.length} ${left.toFixed(4)}`}
                onPointerEnter={touch(post, lane, left)}
                onFocus={touch(post, lane, left)}
                data-side={left > 0.5 ? 'right' : 'left'}
                style={{ left: `${left * 100}%`, top: `${((lane + 0.07) / LANES.length) * 100}%`, width: `${widthOf(lane, left) * 100}%`, height: `${86 / LANES.length}%` }}
              >
                <span>{post.title}</span>
              </a>
            </li>
          ))}
        </ol>
        <ul className="wc-lanes" aria-hidden="true">
          {LANES.map(([name]) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
      <ul className="wc-years" aria-hidden="true">
        {years.map((year, i) => (
          <li key={year} data-paint="tick" data-crowded={i > 0 && i < years.length - 1 && at(ordered.find((date) => date.startsWith(years[i + 1]))!) - at(ordered.find((date) => date.startsWith(year))!) < 0.1 || undefined} style={{ left: `${(at(ordered.find((date) => date.startsWith(year))!) - 0.006) * 100}%` }}>
            {year}
          </li>
        ))}
      </ul>
      <div className="wc-buttons" data-paint="quiet">
        <button type="button" aria-pressed={playing} onClick={press}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {playing ? <path d="M5 4.5c3.4-.5 6.5-.3 10.2 0 .3 3.6.2 7.2 0 11-3.6.3-6.8.2-10.2 0-.3-3.9-.2-7.5 0-11z" /> : <path d="M5.5 3.2c3.700 1.8 7.2 3.9 10.8 6.6-3.400 2.7-6.9 4.9-10.6 7-.5-4.7-.6-9-.2-13.6z" />}
          </svg>
          {playing ? 'Stop' : 'Play the score'}
        </button>
        {sounding && !playing && (
          <button type="button" onClick={quiet}>
            Sound off
          </button>
        )}
      </div>
    </div>
  )
}
