import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'
import type { GithubRepositorySummary, PostSummary } from '../types/page'

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

function Entry({ href, external, name, label, children }: { href: string; external: boolean; name: string; label?: string; children: ReactNode }) {
  const shared = { className: 'wc-entry', 'data-paint': name, 'data-key': href, 'aria-label': label }
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...shared}>
      {children}
    </a>
  ) : (
    <Link href={href} {...shared}>
      {children}
    </Link>
  )
}

export function Thoughts({ posts, room }: { posts: PostSummary[]; room: string }) {
  return (
    <ul className="wc-entries wc-thoughts">
      {posts.map((post) => (
        <li key={post.slug} data-wander>
          <Entry href={post.external_url ?? post.path} external={Boolean(post.external_url)} name={room === 'name' ? 'line' : 'card'}>
            {room === 'score' ? <span className="wc-thumb" data-paint="picture" data-key={post.slug} aria-hidden="true" /> : <span className="wc-swatch" data-paint="swatch" data-key={post.slug} aria-hidden="true" />}
            {room === 'mosaic' && <span className="wc-phrase" data-paint="phrase" data-key={post.slug} data-strong={post.title} data-pale={post.description} aria-hidden="true" />}
            <h3>{post.title}</h3>
            <p>{post.description}</p>
            <div className="wc-facts">
              <time dateTime={post.date}>{SHORT_DATE_FORMAT.format(new Date(`${post.date}T00:00:00Z`))}</time>
              {post.external_url && <span>Every ↗</span>}
            </div>
          </Entry>
        </li>
      ))}
    </ul>
  )
}

export function Repositories({ repositories, room }: { repositories: GithubRepositorySummary[]; room: string }) {
  if (repositories.length === 0) return <p>More code is on GitHub.</p>
  return (
    <ul className="wc-entries wc-repositories">
      {repositories.map((repository) => (
        <li key={repository.name} data-wander>
          <Entry href={repository.url} external name={room === 'name' ? 'line' : 'repo'} label={`${repository.name} on GitHub`}>
            <span className="wc-swatch" data-paint="swatch" data-key={repository.name} aria-hidden="true" />
            {room === 'mosaic' && <span className="wc-phrase" data-paint="phrase" data-key={repository.name} data-strong={repository.name} data-pale={repository.description ?? ''} aria-hidden="true" />}
            <h3>{repository.name}</h3>
            {repository.description && <p>{repository.description}</p>}
            <div className="wc-facts">
              <span>{repository.language}</span>
              <span aria-label={`${repository.stars} ${repository.stars === 1 ? 'star' : 'stars'}`}>★ {repository.stars}</span>
            </div>
          </Entry>
        </li>
      ))}
    </ul>
  )
}

export function Section({ title, more, children }: { title: string; more?: ReactNode; children: ReactNode }) {
  return (
    <section className="wc-section" data-paint="section">
      <div className="wc-heading" data-wander>
        <h2 data-paint="heading" data-key={title}>
          {title}
        </h2>
        {more && <span data-paint="heading">{more}</span>}
      </div>
      {children}
    </section>
  )
}
