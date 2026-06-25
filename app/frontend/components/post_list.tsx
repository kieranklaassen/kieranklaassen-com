import { Link } from '@inertiajs/react'
import type { PostSummary } from '../types/page'

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function PostList({ posts }: { posts: PostSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={post.path}
          className="glass-panel block min-h-48 p-5 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
        >
          <h3 className="text-lg font-semibold underline decoration-1 underline-offset-4">{post.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">{post.description}</p>
          <time dateTime={post.date} className="mt-4 block text-xs font-medium tracking-wide text-gray-500 uppercase">
            {SHORT_DATE_FORMAT.format(new Date(`${post.date}T00:00:00Z`))}
          </time>
        </Link>
      ))}
    </div>
  )
}
