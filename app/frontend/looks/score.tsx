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
  return (
    <div className="wc-score">
      <div className="wc-staff" data-paint="staff" data-lanes={LANES.length}>
        <ol>
          {laid.map(({ post, lane, left }) => (
            <li key={post.slug}>
              <a
                href={post.external_url ?? post.path}
                {...(post.external_url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="wc-note"
                data-paint="note"
                data-key={post.slug}
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
    </div>
  )
}
